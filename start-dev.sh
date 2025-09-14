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
docker compose down

# Build and start containers
echo "🏗️  Building and starting containers..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check container status
echo "📊 Container Status:"
docker compose ps

# Test API health
echo "🏥 Testing API health..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ API is healthy!"
else
    echo "⚠️  API health check failed. Check logs with: docker compose logs web-api"
fi

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📍 Access Points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Documentation: http://localhost:8000/docs"
echo ""
echo "🔑 Login Credentials:"
echo "   Username: $DEFAULT_ADMIN_USERNAME"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop services: docker compose down"
echo "   Restart backend: docker compose restart web-api"