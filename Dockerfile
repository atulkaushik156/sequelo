# Stage 1: Build the React Frontend
FROM node:22 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python, Redis, and FastAPI
FROM python:3.10-slim
WORKDIR /app

# Install Redis Server
RUN apt-get update && \
    apt-get install -y redis-server && \
    rm -rf /var/lib/apt/lists/*

# Install Python Dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code and Database Script
COPY backend/ ./backend/
COPY init_db.py ./

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy startup script and make it executable
COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]