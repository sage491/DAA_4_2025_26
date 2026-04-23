#!/usr/bin/env bash
set -e

echo "Compiling C++..."
g++ backend/main.cpp -o backend/pathfinder

chmod +x backend/pathfinder

echo "Build complete"