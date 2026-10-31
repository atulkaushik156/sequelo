# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency files first (for caching)
COPY frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend source code and build it
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Setup Python Backend & Redis
# ==========================================
FROM python:3.10-slim

# Install Redis Server, PostgreSQL system dependencies, and build tools
RUN apt-get update && apt-get install -y \
    redis-server \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory to the project root
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files (backend/, init_db.py, start.sh, etc.)
COPY . .

# Copy the compiled React app from Stage 1 into the final container
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Fix line endings and permissions for the startup script
RUN sed -i 's/\r$//' start.sh
RUN chmod +x start.sh

# Expose the default port (Render will override this via $PORT at runtime)
EXPOSE 8000

# Run the startup script
CMD ["./start.sh"]