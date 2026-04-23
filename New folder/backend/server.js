const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const RUN_TIMEOUT_MS = 3000;
const BINARY_PATH = path.join(__dirname, 'pathfinder');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('frontend'));

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return { error: 'grid must be a non-empty 2D array.' };
  }

  const width = Array.isArray(grid[0]) ? grid[0].length : 0;
  if (width === 0) {
    return { error: 'grid rows must be non-empty arrays.' };
  }

  const normalized = [];
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== width) {
      return { error: 'grid must be a rectangular 2D array.' };
    }

    const normalizedRow = [];
    for (const cell of row) {
      if (typeof cell !== 'number' || !Number.isFinite(cell) || !Number.isInteger(cell)) {
        return { error: 'grid values must be integers.' };
      }
      normalizedRow.push(cell);
    }
    normalized.push(normalizedRow);
  }

  return { value: normalized };
}

function normalizeCoordinate(value, label, grid) {
  if (!Array.isArray(value) || value.length !== 2) {
    return { error: `${label} must be a two-item array.` };
  }

  const [row, col] = value;
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return { error: `${label} must contain integers.` };
  }

  if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) {
    return { error: `${label} must be within the grid.` };
  }

  return { value: [row, col] };
}

function normalizeAlgorithm(value) {
  const allowed = new Set(['bfs', 'dfs', 'dijkstra', 'astar']);
  const algorithm = typeof value === 'string' ? value.toLowerCase() : 'astar';
  if (!allowed.has(algorithm)) {
    return { error: 'algorithm must be one of bfs, dfs, dijkstra, or astar.' };
  }
  return { value: algorithm };
}

function normalizeHeuristic(value) {
  const allowed = new Set(['manhattan', 'euclidean']);
  const heuristic = typeof value === 'string' ? value.toLowerCase() : 'manhattan';
  if (!allowed.has(heuristic)) {
    return { error: 'heuristic must be manhattan or euclidean.' };
  }
  return { value: heuristic };
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function validatePayload(body) {
  if (!isPlainObject(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const gridResult = normalizeGrid(body.grid);
  if (gridResult.error) {
    return { error: gridResult.error };
  }

  const startResult = normalizeCoordinate(body.start, 'start', gridResult.value);
  if (startResult.error) {
    return { error: startResult.error };
  }

  const endResult = normalizeCoordinate(body.end, 'end', gridResult.value);
  if (endResult.error) {
    return { error: endResult.error };
  }

  const algorithmResult = normalizeAlgorithm(body.algorithm);
  if (algorithmResult.error) {
    return { error: algorithmResult.error };
  }

  const heuristicResult = normalizeHeuristic(body.heuristic);
  if (heuristicResult.error) {
    return { error: heuristicResult.error };
  }

  return {
    value: {
      grid: gridResult.value,
      start: startResult.value,
      end: endResult.value,
      algorithm: algorithmResult.value,
      allowDiagonal: normalizeBoolean(body.allowDiagonal, false),
      heuristic: heuristicResult.value
    }
  };
}

function validateComparePayload(body) {
  if (!isPlainObject(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const gridResult = normalizeGrid(body.grid);
  if (gridResult.error) {
    return { error: gridResult.error };
  }

  const startResult = normalizeCoordinate(body.start, 'start', gridResult.value);
  if (startResult.error) {
    return { error: startResult.error };
  }

  const endResult = normalizeCoordinate(body.end, 'end', gridResult.value);
  if (endResult.error) {
    return { error: endResult.error };
  }

  const heuristicResult = normalizeHeuristic(body.heuristic);
  if (heuristicResult.error) {
    return { error: heuristicResult.error };
  }

  if (!Array.isArray(body.algorithms) || body.algorithms.length < 2) {
    return { error: 'algorithms must be an array with at least 2 items.' };
  }

  const normalizedAlgorithms = [];
  const seen = new Set();
  for (const rawAlgorithm of body.algorithms) {
    const algorithmResult = normalizeAlgorithm(rawAlgorithm);
    if (algorithmResult.error) {
      return { error: algorithmResult.error };
    }
    if (!seen.has(algorithmResult.value)) {
      seen.add(algorithmResult.value);
      normalizedAlgorithms.push(algorithmResult.value);
    }
  }

  if (normalizedAlgorithms.length < 2) {
    return { error: 'Choose at least 2 distinct algorithms.' };
  }

  return {
    value: {
      grid: gridResult.value,
      start: startResult.value,
      end: endResult.value,
      algorithms: normalizedAlgorithms,
      allowDiagonal: normalizeBoolean(body.allowDiagonal, false),
      heuristic: heuristicResult.value
    }
  };
}

function parseEngineOutput(stdout) {
  let parsed;

  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Pathfinder returned invalid JSON: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Pathfinder output must be a JSON array.');
  }

  return parsed.map((step) => {
    if (!isPlainObject(step)) {
      throw new Error('Each pathfinder step must be an object.');
    }

    const { type, x, y } = step;
    if (type !== 'visit' && type !== 'path') {
      throw new Error('Step type must be visit or path.');
    }
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error('Step coordinates must be integers.');
    }

    return { type, x, y };
  });
}

function runBinary(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(BINARY_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Pathfinder timed out after 3 seconds.'));
    }, RUN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      if (!settled) {
        stdout += chunk.toString('utf8');
      }
    });

    child.stderr.on('data', (chunk) => {
      if (!settled) {
        stderr += chunk.toString('utf8');
      }
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to start pathfinder binary: ${error.message}`));
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);

      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Pathfinder exited with code ${code}.`));
        return;
      }

      resolve(stdout);
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function runAndCollect(payload) {
  const startedAt = Date.now();
  const stdout = await runBinary(payload);
  const steps = parseEngineOutput(stdout);
  const visitCount = steps.filter((step) => step.type === 'visit').length;
  const pathCount = steps.filter((step) => step.type === 'path').length;

  return {
    algorithm: payload.algorithm,
    heuristic: payload.heuristic,
    allowDiagonal: payload.allowDiagonal,
    found: pathCount > 0,
    steps,
    metrics: {
      nodesVisited: visitCount,
      pathLength: pathCount,
      executionTimeMs: Date.now() - startedAt
    }
  };
}

function rankAlgorithms(results) {
  const sorted = [...results].sort((left, right) => {
    if (left.found !== right.found) {
      return left.found ? -1 : 1;
    }

    const leftPathLength = left.metrics.pathLength > 0 ? left.metrics.pathLength : Number.MAX_SAFE_INTEGER;
    const rightPathLength = right.metrics.pathLength > 0 ? right.metrics.pathLength : Number.MAX_SAFE_INTEGER;
    if (leftPathLength !== rightPathLength) {
      return leftPathLength - rightPathLength;
    }

    if (left.metrics.nodesVisited !== right.metrics.nodesVisited) {
      return left.metrics.nodesVisited - right.metrics.nodesVisited;
    }

    return left.metrics.executionTimeMs - right.metrics.executionTimeMs;
  });

  return sorted.map((item, index) => ({
    rank: index + 1,
    algorithm: item.algorithm,
    score: {
      executionTimeMs: item.metrics.executionTimeMs,
      nodesVisited: item.metrics.nodesVisited,
      pathLength: item.metrics.pathLength,
      found: item.found
    }
  }));
}

function summarize(results) {
  const found = results.filter((item) => item.found);
  const source = found.length > 0 ? found : results;

  const fastest = source.reduce((best, item) => (
    item.metrics.executionTimeMs < best.metrics.executionTimeMs ? item : best
  ), source[0]);

  const leastNodes = source.reduce((best, item) => (
    item.metrics.nodesVisited < best.metrics.nodesVisited ? item : best
  ), source[0]);

  const shortestPath = source.reduce((best, item) => {
    const bestLength = best.metrics.pathLength > 0 ? best.metrics.pathLength : Number.MAX_SAFE_INTEGER;
    const itemLength = item.metrics.pathLength > 0 ? item.metrics.pathLength : Number.MAX_SAFE_INTEGER;
    return itemLength < bestLength ? item : best;
  }, source[0]);

  return {
    fastest: fastest.algorithm,
    leastNodes: leastNodes.algorithm,
    shortestPath: shortestPath.algorithm,
    explanation: found.length > 0
      ? `${fastest.algorithm.toUpperCase()} ran fastest, ${leastNodes.algorithm.toUpperCase()} explored the fewest nodes, and ${shortestPath.algorithm.toUpperCase()} produced the shortest path.`
      : 'No algorithm reached the goal on this board.'
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/run', async (req, res) => {
  const validation = validatePayload(req.body);
  if (validation.error) {
    badRequest(res, validation.error);
    return;
  }

  try {
    const result = await runAndCollect(validation.value);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error.'
    });
  }
});

app.post('/compare', async (req, res) => {
  const validation = validateComparePayload(req.body);
  if (validation.error) {
    badRequest(res, validation.error);
    return;
  }

  try {
    const results = await Promise.all(
      validation.value.algorithms.map((algorithm) => runAndCollect({
        grid: validation.value.grid,
        start: validation.value.start,
        end: validation.value.end,
        algorithm,
        allowDiagonal: validation.value.allowDiagonal,
        heuristic: validation.value.heuristic
      }))
    );

    res.json({
      mode: 'compare',
      results,
      ranking: rankAlgorithms(results),
      summary: summarize(results)
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error.'
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'frontend', 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }

  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
