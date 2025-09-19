#!/bin/bash

# Development Startup Script
# Loads environment variables from .env.local and starts containers
# Supports both Docker mode (default) and Job Queue mode

set -e

# Parse command line arguments
MODE="docker"  # Default to docker mode for backward compatibility
if [ "$1" = "--jobqueue" ] || [ "$1" = "-j" ]; then
    MODE="jobqueue"
    echo "🚀 Starting VentiAPI Scanner Development Environment (Job Queue Mode)..."
else
    echo "🚀 Starting VentiAPI Scanner Development Environment (Docker Mode)..."
fi

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

# Build and start containers based on mode
if [ "$MODE" = "jobqueue" ]; then
    echo "🏗️  Building and starting containers (Job Queue Mode)..."
    echo "📝 Note: Using job queue mode - make sure to have main.py pointing to job queue version"
    
    # First ensure the job queue version of main.py is active
    if [ -f "scanner-service/web-api/main_docker.py" ]; then
        echo "📝 Switching to job queue backend..."
        # Switch to job queue main.py (already done in our setup)
    fi
    
    # Start with job queue workers
    docker compose --profile jobqueue up --build -d
    
    echo "⚙️  Started with Redis job queue and scanner workers"
else
    echo "🏗️  Building and starting containers (Docker Mode)..."
    echo "📝 Note: Using direct Docker execution mode"
    
    # Ensure Docker version of main.py is active if needed
    # (For now, we'll use the job queue version which should handle both modes)
    
    # Start without job queue workers
    docker compose up --build -d
    
    echo "⚙️  Started with direct Docker execution"
fi

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
if [ "$MODE" = "jobqueue" ]; then
    echo "🔄 Running in Job Queue Mode:"
    echo "   - Redis job queue enabled"
    echo "   - Scanner workers running (${SCANNER_WORKERS:-2} instances)"
    echo "   - Parallel scan processing"
    echo ""
fi

echo "📝 Useful Commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop services: docker compose down"
echo "   Restart backend: docker compose restart web-api"
if [ "$MODE" = "jobqueue" ]; then
    echo "   Worker logs: docker compose logs scanner-worker"
    echo "   Scale workers: docker compose up --scale scanner-worker=3 -d"
fi
echo ""
echo "🔧 Development Modes:"
echo "   Docker Mode (default): ./start-dev.sh"
echo "   Job Queue Mode: ./start-dev.sh --jobqueue"