#!/bin/bash
set -e

echo "Starting Redis server..."
redis-server --daemonize yes

echo "Running database initialization..."
python init_db.py

echo "Starting FastAPI server..."
PORT=${PORT:-8000}

# Move into the src directory so the absolute imports work
cd backend/src
uvicorn main:app --host 0.0.0.0 --port $PORT