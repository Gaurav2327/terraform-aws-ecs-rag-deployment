# Lightweight Dockerfile for AWS Bedrock Backend
# No Ollama needed - uses AWS Bedrock for LLM
# Image size: ~500 MB (vs 7.8 GB with Ollama)

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .

# Expose port
EXPOSE 3000

# Environment variables
ENV PORT=3000
ENV AWS_REGION=us-east-1
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["python", "server.py"]
