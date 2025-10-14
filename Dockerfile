# Multi-stage build for Railway main app service
# Combines nginx reverse proxy + FastAPI backend in single container

# Stage 1: Build React frontend
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python backend
FROM python:3.11-slim as backend-base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY scanner-service/web-api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Add Redis job queue dependencies
RUN pip install redis celery

# Copy backend code
COPY scanner-service/web-api/*.py ./

# Stage 3: Final production image
FROM backend-base as production

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create shared directories
RUN mkdir -p /shared/results /shared/specs /var/log/supervisor

# Copy supervisor configuration for multi-process
COPY supervisor.conf /etc/supervisor/conf.d/supervisord.conf

# Create startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 3000 for Railway
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use supervisor to run both nginx and FastAPI
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]