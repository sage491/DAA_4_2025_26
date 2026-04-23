# Pathfinding Visualizer

This repository is configured for direct deployment on Render.

The app has three parts:

- A Node.js and Express backend in [backend/server.js](backend/server.js)
- A Linux C++ pathfinding engine in [backend/main.cpp](backend/main.cpp)
- A browser frontend in [frontend/index.html](frontend/index.html), [frontend/style.css](frontend/style.css), and [frontend/script.js](frontend/script.js)

## How it works

The frontend sends the current grid state to `POST /run` using `fetch('/run')`. The backend validates the JSON payload, spawns the compiled C++ binary at [backend/pathfinder](backend/pathfinder), sends the payload through stdin, and returns the engine's JSON step list plus runtime metrics.

The C++ binary accepts JSON from stdin, computes the selected pathfinding algorithm, and prints only valid JSON to stdout. It does not log to the console.

## Render Deployment

Deployment is already configured for Render with [render.yaml](render.yaml).

Render will:

1. Install dependencies from [package.json](package.json)
2. Run `chmod +x build.sh && ./build.sh`
3. Compile the C++ binary with `g++ backend/main.cpp -o backend/pathfinder`
4. Start the app with `npm start`

To deploy:

1. Push this repository to GitHub.
2. Create a new Render Web Service from that repository.
3. Let Render use the included `render.yaml`.
4. Deploy.

No manual server setup is required after the first push.

## Local Development

From the project root:

```bash
npm install
chmod +x build.sh
./build.sh
npm start
```

Open `http://localhost:3000` in your browser.

## API

### POST /run

Request body:

```json
{
  "grid": [[1, 1, 1], [1, -1, 1], [1, 1, 1]],
  "start": [0, 0],
  "end": [2, 2],
  "algorithm": "astar",
  "allowDiagonal": false,
  "heuristic": "manhattan"
}
```

Response body:

```json
{
  "algorithm": "astar",
  "heuristic": "manhattan",
  "allowDiagonal": false,
  "found": true,
  "steps": [
    {"type": "visit", "x": 0, "y": 0},
    {"type": "visit", "x": 0, "y": 1},
    {"type": "path", "x": 0, "y": 0},
    {"type": "path", "x": 0, "y": 1},
    {"type": "path", "x": 0, "y": 2}
  ],
  "metrics": {
    "nodesVisited": 2,
    "pathLength": 3,
    "executionTimeMs": 12
  }
}
```

Supported algorithms: `bfs`, `dfs`, `dijkstra`, and `astar`.
