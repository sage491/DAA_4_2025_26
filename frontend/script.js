const SIZE = 20;
const WALL = -1;
const DEFAULT_WEIGHT = 1;
const DEFAULT_START = { r: 3, c: 3 };
const DEFAULT_END = { r: 16, c: 16 };
const ALGO_COLORS = ['a0', 'a1', 'a2', 'a3'];

const gridEl = document.getElementById('grid');
const algorithmSelect = document.getElementById('algorithmSelect');
const heuristicSelect = document.getElementById('heuristicSelect');
const diagonalToggle = document.getElementById('diagonalToggle');
const speedRange = document.getElementById('speedRange');
const speedLabel = document.getElementById('speedLabel');
const weightRange = document.getElementById('weightRange');
const weightLabel = document.getElementById('weightLabel');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stepBtn = document.getElementById('stepBtn');
const resetBtn = document.getElementById('resetBtn');
const clearWallsBtn = document.getElementById('clearWallsBtn');
const randomWallsBtn = document.getElementById('randomWallsBtn');
const randomMazeBtn = document.getElementById('randomMazeBtn');
const shareBtn = document.getElementById('shareBtn');
const savePresetBtn = document.getElementById('savePresetBtn');
const loadPresetBtn = document.getElementById('loadPresetBtn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const rankingEl = document.getElementById('ranking');
const runtimeStatsEl = document.getElementById('runtimeStats');
const overlayEl = document.getElementById('overlay');
const startLabel = document.getElementById('startLabel');
const endLabel = document.getElementById('endLabel');
const singleAlgorithmGroup = document.getElementById('singleAlgorithmGroup');
const compareAlgorithmsGroup = document.getElementById('compareAlgorithmsGroup');
const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
const compareCheckboxes = Array.from(document.querySelectorAll('#compareCheckboxes input[type="checkbox"]'));

let grid = createEmptyGrid();
let startNode = { ...DEFAULT_START };
let endNode = { ...DEFAULT_END };
let cells = [];
let mouseDown = false;
let dragMode = null;
let paintWallValue = WALL;
let isRunning = false;
let isPaused = false;
let stepRequested = false;

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => DEFAULT_WEIGHT));
}

function inBounds(r, c) {
  return r >= 0 && c >= 0 && r < SIZE && c < SIZE;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function updateLabels() {
  speedLabel.textContent = String(speedRange.value);
  weightLabel.textContent = String(weightRange.value);
  startLabel.textContent = `Row ${startNode.r}, Col ${startNode.c}`;
  endLabel.textContent = `Row ${endNode.r}, Col ${endNode.c}`;
}

function getMode() {
  const selected = modeInputs.find((input) => input.checked);
  return selected ? selected.value : 'single';
}

function selectedCompareAlgorithms() {
  return compareCheckboxes.filter((cb) => cb.checked).map((cb) => cb.value);
}

function toTitle(value) {
  if (value === 'astar') {
    return 'A*';
  }
  return value.toUpperCase();
}

function getCell(r, c) {
  return cells[r]?.[c] || null;
}

function clearSearchMarks() {
  for (const row of cells) {
    for (const cell of row) {
      cell.classList.remove(
        'visited',
        'path',
        'visit-a0',
        'visit-a1',
        'visit-a2',
        'visit-a3',
        'path-a0',
        'path-a1',
        'path-a2',
        'path-a3'
      );
    }
  }
}

function paintCellLook(cell, value) {
  if (!cell) {
    return;
  }
  cell.classList.toggle('wall', value === WALL);
  cell.classList.toggle('weighted', value > 1);
  if (value > 1) {
    cell.dataset.weight = String(value);
  } else {
    delete cell.dataset.weight;
  }
}

function renderGrid() {
  gridEl.innerHTML = '';
  cells = [];

  for (let r = 0; r < SIZE; r += 1) {
    const row = [];
    cells.push(row);
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      paintCellLook(cell, grid[r][c]);

      if (r === startNode.r && c === startNode.c) {
        cell.classList.add('start');
      }
      if (r === endNode.r && c === endNode.c) {
        cell.classList.add('end');
      }

      cell.addEventListener('pointerdown', (event) => onCellDown(event, r, c));
      cell.addEventListener('pointerenter', (event) => onCellEnter(event, r, c));

      row.push(cell);
      gridEl.appendChild(cell);
    }
  }
}

function paintWeightAt(r, c, weightValue) {
  if (!inBounds(r, c)) {
    return;
  }
  if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) {
    return;
  }

  grid[r][c] = weightValue;
  const cell = getCell(r, c);
  if (!cell) {
    return;
  }

  paintCellLook(cell, weightValue);
  cell.classList.remove('visited', 'path');
}

function moveNode(kind, r, c) {
  if (!inBounds(r, c) || grid[r][c] === WALL) {
    return;
  }

  const other = kind === 'start' ? endNode : startNode;
  if (r === other.r && c === other.c) {
    return;
  }

  const oldNode = kind === 'start' ? startNode : endNode;
  const oldCell = getCell(oldNode.r, oldNode.c);
  if (oldCell) {
    oldCell.classList.remove(kind);
  }

  if (kind === 'start') {
    startNode = { r, c };
  } else {
    endNode = { r, c };
  }

  const newCell = getCell(r, c);
  if (newCell) {
    newCell.classList.add(kind);
    newCell.classList.remove('visited', 'path');
  }

  updateLabels();
}

function onCellDown(event, r, c) {
  if (isRunning) {
    return;
  }

  mouseDown = true;

  if (r === startNode.r && c === startNode.c) {
    dragMode = 'start';
    return;
  }
  if (r === endNode.r && c === endNode.c) {
    dragMode = 'end';
    return;
  }

  if (event.shiftKey) {
    dragMode = 'weight';
    paintWeightAt(r, c, Number(weightRange.value));
    return;
  }

  dragMode = 'wall';
  paintWallValue = grid[r][c] === WALL ? DEFAULT_WEIGHT : WALL;
  paintWeightAt(r, c, paintWallValue);
}

function onCellEnter(event, r, c) {
  if (!mouseDown || isRunning) {
    return;
  }

  if (dragMode === 'start') {
    moveNode('start', r, c);
  } else if (dragMode === 'end') {
    moveNode('end', r, c);
  } else if (dragMode === 'wall') {
    paintWeightAt(r, c, paintWallValue);
  } else if (dragMode === 'weight') {
    paintWeightAt(r, c, Number(weightRange.value));
  }
}

function setModeUI() {
  const mode = getMode();
  singleAlgorithmGroup.classList.toggle('hidden', mode !== 'single');
  compareAlgorithmsGroup.classList.toggle('hidden', mode !== 'compare');
}

function setExecutionControls(running) {
  isRunning = running;
  overlayEl.classList.add('hidden');
  startBtn.disabled = running;
  pauseBtn.disabled = !running;
  stepBtn.disabled = !running;

  const lock = running;
  for (const input of [
    algorithmSelect,
    heuristicSelect,
    diagonalToggle,
    speedRange,
    weightRange,
    resetBtn,
    clearWallsBtn,
    randomWallsBtn,
    randomMazeBtn,
    shareBtn,
    savePresetBtn,
    loadPresetBtn,
    ...modeInputs,
    ...compareCheckboxes
  ]) {
    input.disabled = lock;
  }
}

function speedToStepsPerFrame() {
  const speed = Number(speedRange.value);
  return Math.max(1, Math.floor(speed / 16));
}

function buildBasePayload() {
  return {
    grid,
    start: [startNode.r, startNode.c],
    end: [endNode.r, endNode.c],
    heuristic: heuristicSelect.value,
    allowDiagonal: diagonalToggle.checked
  };
}

function renderRuntimeStats(items, progressMap) {
  runtimeStatsEl.innerHTML = '';

  for (const item of items) {
    const progress = progressMap.get(item.algorithm) || { visits: 0, path: 0 };
    const block = document.createElement('div');
    block.className = 'row-block';
    block.innerHTML = `
      <div class="row"><span>Algorithm</span><strong>${toTitle(item.algorithm)}</strong></div>
      <div class="row"><span>Status</span><strong>${item.found ? 'Path found' : 'No path'}</strong></div>
      <div class="row"><span>Visited</span><strong>${progress.visits}/${item.metrics.nodesVisited}</strong></div>
      <div class="row"><span>Path length</span><strong>${item.metrics.pathLength}</strong></div>
      <div class="row"><span>Runtime</span><strong>${item.metrics.executionTimeMs} ms</strong></div>
    `;
    runtimeStatsEl.appendChild(block);
  }
}

function renderSummary(summary) {
  if (!summary) {
    summaryEl.textContent = 'Run pathfinding to see analysis.';
    return;
  }

  summaryEl.innerHTML = `
    <div class="row"><span>Fastest</span><strong>${summary.fastest ? toTitle(summary.fastest) : 'N/A'}</strong></div>
    <div class="row"><span>Least nodes</span><strong>${summary.leastNodes ? toTitle(summary.leastNodes) : 'N/A'}</strong></div>
    <div class="row"><span>Shortest path</span><strong>${summary.shortestPath ? toTitle(summary.shortestPath) : 'N/A'}</strong></div>
    <div class="row"><span>Summary</span><strong>${summary.explanation || 'No summary available.'}</strong></div>
  `;
}

function renderRanking(ranking) {
  rankingEl.innerHTML = '';

  if (!Array.isArray(ranking) || ranking.length === 0) {
    rankingEl.textContent = 'No ranking available.';
    return;
  }

  for (const item of ranking) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>#${item.rank} ${toTitle(item.algorithm)}</span><strong>${item.score.executionTimeMs} ms</strong>`;
    rankingEl.appendChild(row);
  }
}

async function fetchRunResults() {
  const mode = getMode();

  if (mode === 'single') {
    const response = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildBasePayload(), algorithm: algorithmSelect.value })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Pathfinding request failed.');
    }

    return {
      mode,
      results: [data],
      ranking: [{
        rank: 1,
        algorithm: data.algorithm,
        score: {
          executionTimeMs: data.metrics.executionTimeMs,
          nodesVisited: data.metrics.nodesVisited,
          pathLength: data.metrics.pathLength
        }
      }],
      summary: {
        fastest: data.algorithm,
        leastNodes: data.algorithm,
        shortestPath: data.algorithm,
        explanation: data.found
          ? `${toTitle(data.algorithm)} completed the route on this board.`
          : `${toTitle(data.algorithm)} could not reach the destination.`
      }
    };
  }

  const algorithms = selectedCompareAlgorithms();
  if (algorithms.length < 2) {
    throw new Error('Select at least 2 algorithms for compare mode.');
  }

  const response = await fetch('/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...buildBasePayload(), algorithms })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Comparison request failed.');
  }

  return data;
}

function flattenAnimationQueue(results) {
  const streams = results.map((result, algoIndex) => ({
    algorithm: result.algorithm,
    algoIndex,
    visits: result.steps.filter((step) => step.type === 'visit'),
    path: result.steps.filter((step) => step.type === 'path'),
    visitPtr: 0,
    pathPtr: 0
  }));

  const queue = [];
  let pending = true;
  while (pending) {
    pending = false;
    for (const stream of streams) {
      const step = stream.visits[stream.visitPtr];
      if (step) {
        queue.push({ ...step, algoIndex: stream.algoIndex, algorithm: stream.algorithm });
        stream.visitPtr += 1;
        pending = true;
      }
    }
  }

  pending = true;
  while (pending) {
    pending = false;
    for (const stream of streams) {
      const step = stream.path[stream.pathPtr];
      if (step) {
        queue.push({ ...step, algoIndex: stream.algoIndex, algorithm: stream.algorithm });
        stream.pathPtr += 1;
        pending = true;
      }
    }
  }

  return queue;
}

function applyAnimationStep(step, mode) {
  const cell = getCell(step.x, step.y);
  if (!cell) {
    return;
  }

  const isEndpoint = (step.x === startNode.r && step.y === startNode.c) || (step.x === endNode.r && step.y === endNode.c);
  if (isEndpoint) {
    return;
  }

  if (mode === 'single') {
    if (step.type === 'visit') {
      cell.classList.add('visited');
    } else if (step.type === 'path') {
      cell.classList.remove('visited');
      cell.classList.add('path');
    }
    return;
  }

  const colorKey = ALGO_COLORS[step.algoIndex % ALGO_COLORS.length];
  if (step.type === 'visit') {
    cell.classList.add(`visit-${colorKey}`);
  } else if (step.type === 'path') {
    cell.classList.add(`path-${colorKey}`);
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function animateResults(data) {
  const queue = flattenAnimationQueue(data.results);
  const progress = new Map();
  for (const result of data.results) {
    progress.set(result.algorithm, { visits: 0, path: 0 });
  }

  let pointer = 0;
  renderRuntimeStats(data.results, progress);

  while (pointer < queue.length) {
    if (!isRunning) {
      return;
    }

    if (isPaused) {
      await nextFrame();
      continue;
    }

    if (!stepRequested && stepBtn.dataset.mode === 'step') {
      await nextFrame();
      continue;
    }

    const iterations = stepBtn.dataset.mode === 'step' ? 1 : speedToStepsPerFrame();
    for (let i = 0; i < iterations && pointer < queue.length; i += 1) {
      const step = queue[pointer];
      applyAnimationStep(step, data.mode);
      const stat = progress.get(step.algorithm);
      if (stat) {
        if (step.type === 'visit') {
          stat.visits += 1;
        } else if (step.type === 'path') {
          stat.path += 1;
        }
      }
      pointer += 1;
    }

    stepRequested = false;
    renderRuntimeStats(data.results, progress);
    await nextFrame();
  }
}

async function runVisualization() {
  if (isRunning) {
    return;
  }

  clearSearchMarks();
  setExecutionControls(true);
  isPaused = false;
  stepRequested = false;
  pauseBtn.textContent = 'Pause';
  setStatus('Running pathfinding...');

  try {
    const data = await fetchRunResults();
    renderSummary(data.summary);
    renderRanking(data.ranking);
    await animateResults(data);
    setStatus('Completed.');
  } catch (error) {
    setStatus(error.message || 'Pathfinding failed.', true);
  } finally {
    setExecutionControls(false);
  }
}

function clearWalls() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) {
        continue;
      }
      grid[r][c] = DEFAULT_WEIGHT;
      paintCellLook(getCell(r, c), DEFAULT_WEIGHT);
    }
  }
}

function randomWalls() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) {
        continue;
      }
      grid[r][c] = Math.random() < 0.28 ? WALL : DEFAULT_WEIGHT;
      paintCellLook(getCell(r, c), grid[r][c]);
    }
  }
}

function randomMaze() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) {
        continue;
      }
      const wallBand = r % 4 === 0 || c % 4 === 0;
      const hole = Math.random() < 0.22;
      grid[r][c] = wallBand && !hole ? WALL : DEFAULT_WEIGHT;
      paintCellLook(getCell(r, c), grid[r][c]);
    }
  }
}

function resetBoard() {
  grid = createEmptyGrid();
  startNode = { ...DEFAULT_START };
  endNode = { ...DEFAULT_END };
  mouseDown = false;
  dragMode = null;
  paintWallValue = WALL;
  renderGrid();
  clearSearchMarks();
  updateLabels();
  renderSummary(null);
  renderRanking([]);
  runtimeStatsEl.textContent = '';
  setStatus('Board reset.');
}

function snapshotPreset() {
  return {
    grid,
    startNode,
    endNode,
    algorithm: algorithmSelect.value,
    heuristic: heuristicSelect.value,
    diagonal: diagonalToggle.checked,
    mode: getMode(),
    compareAlgorithms: selectedCompareAlgorithms()
  };
}

function applyPreset(preset) {
  if (!preset || !Array.isArray(preset.grid)) {
    throw new Error('Invalid preset payload.');
  }

  grid = preset.grid;
  startNode = preset.startNode || { ...DEFAULT_START };
  endNode = preset.endNode || { ...DEFAULT_END };
  if (typeof preset.algorithm === 'string') {
    algorithmSelect.value = preset.algorithm;
  }
  if (typeof preset.heuristic === 'string') {
    heuristicSelect.value = preset.heuristic;
  }
  diagonalToggle.checked = Boolean(preset.diagonal);

  const mode = preset.mode === 'compare' ? 'compare' : 'single';
  for (const input of modeInputs) {
    input.checked = input.value === mode;
  }

  if (Array.isArray(preset.compareAlgorithms)) {
    for (const checkbox of compareCheckboxes) {
      checkbox.checked = preset.compareAlgorithms.includes(checkbox.value);
    }
  }

  setModeUI();
  renderGrid();
  clearSearchMarks();
  updateLabels();
}

function bindEvents() {
  document.addEventListener('pointerup', () => {
    mouseDown = false;
    dragMode = null;
  });

  modeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      setModeUI();
      setStatus(`Mode switched to ${getMode()}.`);
    });
  });

  startBtn.addEventListener('click', runVisualization);
  pauseBtn.addEventListener('click', () => {
    if (!isRunning) {
      return;
    }
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  });

  stepBtn.dataset.mode = 'flow';
  stepBtn.addEventListener('click', () => {
    if (!isRunning) {
      stepBtn.dataset.mode = stepBtn.dataset.mode === 'step' ? 'flow' : 'step';
      setStatus(stepBtn.dataset.mode === 'step' ? 'Step mode enabled.' : 'Continuous mode enabled.');
      return;
    }
    if (stepBtn.dataset.mode !== 'step') {
      return;
    }
    stepRequested = true;
  });

  resetBtn.addEventListener('click', () => {
    if (!isRunning) {
      resetBoard();
    }
  });

  clearWallsBtn.addEventListener('click', () => {
    if (!isRunning) {
      clearWalls();
      clearSearchMarks();
      setStatus('Walls and weights cleared.');
    }
  });

  randomWallsBtn.addEventListener('click', () => {
    if (!isRunning) {
      randomWalls();
      clearSearchMarks();
      setStatus('Random walls generated.');
    }
  });

  randomMazeBtn.addEventListener('click', () => {
    if (!isRunning) {
      randomMaze();
      clearSearchMarks();
      setStatus('Random maze generated.');
    }
  });

  shareBtn.addEventListener('click', async () => {
    const encoded = btoa(JSON.stringify(snapshotPreset()));
    const url = `${location.origin}${location.pathname}?preset=${encodeURIComponent(encoded)}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Share link copied.');
    } catch {
      setStatus(url);
    }
  });

  savePresetBtn.addEventListener('click', () => {
    localStorage.setItem('pathfinder-preset', JSON.stringify(snapshotPreset()));
    setStatus('Preset saved.');
  });

  loadPresetBtn.addEventListener('click', () => {
    const presetRaw = localStorage.getItem('pathfinder-preset');
    if (!presetRaw) {
      setStatus('No preset found.', true);
      return;
    }

    try {
      applyPreset(JSON.parse(presetRaw));
      setStatus('Preset loaded.');
    } catch {
      setStatus('Preset is invalid.', true);
    }
  });

  speedRange.addEventListener('input', updateLabels);
  weightRange.addEventListener('input', updateLabels);
}

function loadPresetFromUrl() {
  const params = new URLSearchParams(location.search);
  const encoded = params.get('preset');
  if (!encoded) {
    return;
  }

  try {
    const parsed = JSON.parse(atob(encoded));
    applyPreset(parsed);
    setStatus('Loaded preset from URL.');
  } catch {
    setStatus('Failed to load URL preset.', true);
  }
}

updateLabels();
renderGrid();
setModeUI();
bindEvents();
loadPresetFromUrl();
