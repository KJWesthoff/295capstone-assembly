#!/bin/bash

# Development Startup Script
# Loads environment variables from .env.local and starts containers

set -e

echo "🚀 Starting VentiAPI Scanner Development Environment..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Please ensure it exists with your development credentials."
    exit 1
fi

# Load environment variables from .env.local
echo "📋 Loading environment variables from .env.local..."
export $(grep -v '^#' .env.local | xargs)

# Verify critical variables are loaded
if [ -z "$JWT_SECRET" ] || [ -z "$DEFAULT_ADMIN_USERNAME" ] || [ -z "$DEFAULT_ADMIN_PASSWORD" ]; then
    echo "❌ Missing required environment variables in .env.local"
    echo "Required: JWT_SECRET, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD"
    exit 1
fi

echo "✅ Loaded credentials:"
echo "   Admin Username: $DEFAULT_ADMIN_USERNAME"
echo "   Admin Password: $DEFAULT_ADMIN_PASSWORD"
echo "   JWT Secret: ${JWT_SECRET:0:20}..."

# Stop existing containers and clean up
echo "🛑 Stopping existing containers..."
docker compose down --remove-orphans

# Clean up Docker networking issues
echo "🧹 Cleaning up Docker networks and containers..."
docker network prune -f
docker container prune -f

# Build scanner image first
echo "🔨 Building scanner image..."
docker compose --profile build-only up --build scanner

# Tag scanner image with expected name
echo "🏷️  Tagging scanner image..."
docker tag ventiapi-scanner:latest ventiapi-scanner/scanner:latest

# Build and start containers
echo "🏗️  Building and starting containers..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check container status
echo "📊 Container Status:"
docker compose ps

# Test nginx and API health
echo "🏥 Testing application health..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Application is healthy!"
else
    echo "⚠️  Health check failed. Check logs with: docker compose logs"
fi

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📍 Access Points:"
echo "   Application: http://localhost:3000 (nginx serves frontend + proxies API)"
echo "   API Endpoints: http://localhost:3000/api/* (proxied to backend)"
echo "   API Documentation: http://localhost:3000/api/docs"
echo ""
echo "🔑 Login Credentials:"
echo "   Username: $DEFAULT_ADMIN_USERNAME"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop services: docker compose down"
echo "   Restart backend: docker compose restart web-api"