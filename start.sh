#!/bin/bash

echo "Starting Redis..."
redis-server --daemonize yes

echo "Initializing Database..."
python init_db.py

echo "Starting FastAPI..."
export PYTHONPATH=$PYTHONPATH:/app/backend/src

# Fallback to 8000 locally, but use Render's dynamic $PORT in production
PORT=${PORT:-8000}
uvicorn backend.src.main:app --host 0.0.0.0 --port $PORT