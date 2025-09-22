#!/bin/bash

# VentiAPI Scanner - Local Development Startup
# Simplified script for local development environment

set -e

echo "🚀 Starting VentiAPI Scanner Development Environment..."

# Check if .env.local exists, if not create from example
if [ ! -f ".env.local" ]; then
    if [ -f ".env.local.example" ]; then
        echo "📋 Creating .env.local from example..."
        cp .env.local.example .env.local
        echo "⚠️  Please edit .env.local with your development credentials before continuing."
        echo "   Required: JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD"
        exit 1
    else
        echo "❌ No .env.local or .env.local.example found!"
        exit 1
    fi
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down --remove-orphans

# Build scanner image first (required for scans to work)
echo "🔨 Building scanner image..."
docker compose --profile build-only build scanner

# Build and start all services
echo "🏗️  Building and starting all services..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check container status
echo "📊 Container Status:"
docker compose ps

# Test application health
echo "🏥 Testing application health..."
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ Application is running!"
else
    echo "⚠️  Application might not be ready yet. Check logs with: docker-compose logs"
fi

echo ""
echo "🎉 Development environment started!"
echo ""
echo "📍 Access Points:"
echo "   🌐 Application: http://localhost:3000"
echo "   📚 API Documentation: http://localhost:3000/api/docs"
echo ""
echo "🔑 Check your .env.local file for login credentials"
echo ""
echo "📝 Useful Commands:"
echo "   📋 View logs: docker compose logs -f"
echo "   🛑 Stop services: docker compose down"
echo "   🔄 Restart backend: docker compose restart web-api"
echo "   🔨 Rebuild scanner: docker compose --profile build-only build scanner"