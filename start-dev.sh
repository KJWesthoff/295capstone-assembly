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

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Build and start containers with development overrides
echo "🏗️  Building and starting containers (development mode)..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check container status
echo "📊 Container Status:"
docker compose ps

# Test API health via nginx proxy
echo "🏥 Testing API health..."
sleep 3  # Give nginx time to start
if curl -s http://localhost/health > /dev/null; then
    echo "✅ API is healthy via nginx proxy!"
else
    echo "⚠️  API health check failed. Check logs with: docker compose logs nginx web-api"
fi

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📍 Access Points:"
echo "   Frontend (Direct): http://localhost:3000"
echo "   Frontend (via Nginx): http://localhost"
echo "   API (via Nginx): http://localhost/api/*"
echo "   API Documentation: http://localhost/api/docs"
echo ""
echo "🔑 Login Credentials:"
echo "   Username: $DEFAULT_ADMIN_USERNAME"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop services: docker compose down"
echo "   Restart backend: docker compose restart web-api"