#!/bin/bash
set -e

# Railway environment variable handling
echo "🚀 Starting VentiAPI Scanner Main Service..."

# Set default values for Railway deployment
export REDIS_URL=${REDIS_URL:-"redis://redis:6379"}
export JWT_SECRET=${JWT_SECRET:-"railway-default-jwt-secret-change-in-production"}
export DEFAULT_ADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME:-"admin"}
export DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-"admin"}
export SCANNER_MAX_PARALLEL_CONTAINERS=${SCANNER_MAX_PARALLEL_CONTAINERS:-"3"}
export SCANNER_CONTAINER_MEMORY_LIMIT=${SCANNER_CONTAINER_MEMORY_LIMIT:-"512m"}

# Create shared directories if they don't exist
mkdir -p /shared/results /shared/specs

# Set permissions for shared directories
chmod 755 /shared/results /shared/specs

# Test nginx configuration
nginx -t

echo "✅ Environment configured for Railway deployment"
echo "📍 Main app will be available on port 3000"
echo "🔐 Admin username: ${DEFAULT_ADMIN_USERNAME}"

# Execute the command passed to docker run
exec "$@"