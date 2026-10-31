# Use official Python image
FROM python:3.10-slim

# Install Redis Server and dependencies
RUN apt-get update && apt-get install -y redis-server

# Set working directory
WORKDIR /app

# Copy dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# FIX: Strip Windows line endings from the script so Linux can read it
RUN sed -i 's/\r$//' start.sh
# Grant execution rights to the startup script
RUN chmod +x start.sh

# Expose the FastAPI port
EXPOSE 8000

# Run the startup script
CMD ["./start.sh"]