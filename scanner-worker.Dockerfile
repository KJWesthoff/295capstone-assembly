# Railway Scanner Worker Service
# Stateless scanner that pulls jobs from Redis queue

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the external scanner source from submodule
COPY external-scanner/ventiapi-scanner/ ./scanner/

# Install Python dependencies from the original requirements.txt
RUN pip install --no-cache-dir -r scanner/requirements.txt

# Install additional dependencies for worker functionality
RUN pip install \
    boto3>=1.34.0 \
    redis>=4.5.0 \
    celery>=5.3.0 \
    requests>=2.31.0

# Install the scanner package in editable mode
RUN cd scanner && pip install -e .

# Copy worker application
COPY scanner-worker/ ./

# Copy simple wrapper script for scanner execution
COPY venti_wrapper.py ./venti_wrapper.py

# Create shared volume mount points
RUN mkdir -p /shared/results /shared/specs

# Create worker user for security
RUN groupadd -r worker && useradd -r -g worker worker
RUN chown -R worker:worker /app /shared
USER worker

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import redis; r=redis.from_url('${REDIS_URL}'); r.ping()" || exit 1

# Default command runs the worker
CMD ["python", "worker.py"]