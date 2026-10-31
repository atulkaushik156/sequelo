# Use official Python image
FROM python:3.10-slim

# FIX 1: Install Redis Server, PostgreSQL system dependencies, and build tools
RUN apt-get update && apt-get install -y \
    redis-server \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Strip Windows line endings from the script so Linux can read it
RUN sed -i 's/\r$//' start.sh
# Grant execution rights to the startup script
RUN chmod +x start.sh

# Expose the FastAPI port
EXPOSE 8000

# Run the startup script
CMD ["./start.sh"]