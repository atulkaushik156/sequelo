#!/bin/bash

# 1. Start local Redis server in the background
echo "Starting Redis..."
redis-server --daemonize yes

# 2. Run your NeonDB initialization script
echo "Initializing Database..."
python init_db.py

# 3. Start the FastAPI backend
# Using PYTHONPATH to ensure backend/src is resolved correctly
echo "Starting FastAPI..."
export PYTHONPATH=$PYTHONPATH:/app/backend/src
uvicorn backend.src.main:app --host 0.0.0.0 --port 8000