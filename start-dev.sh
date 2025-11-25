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

# Validate required credentials exist in .env.local
if ! grep -q "ADMIN_USERNAME=" .env.local || ! grep -q "ADMIN_PASSWORD=" .env.local; then
    echo "⚠️  Warning: ADMIN_USERNAME or ADMIN_PASSWORD not found in .env.local"
    echo "   These credentials are required for Cedar frontend to authenticate with the scanner service"
fi

# Check if cedar-mastra/.env exists, create if missing
if [ ! -f "cedar-mastra/.env" ]; then
    echo "📋 Creating cedar-mastra/.env file..."
    # Source the credentials from .env.local
    if [ -f ".env.local" ]; then
        ADMIN_USER=$(grep "^ADMIN_USERNAME=" .env.local | cut -d'=' -f2)
        ADMIN_PASS=$(grep "^ADMIN_PASSWORD=" .env.local | cut -d'=' -f2)

        cat > cedar-mastra/.env << EOF
# Scanner Service Configuration (through nginx proxy)
NEXT_PUBLIC_SCANNER_SERVICE_URL=http://localhost:3000
NEXT_PUBLIC_SCANNER_USERNAME=${ADMIN_USER:-MICS295}
NEXT_PUBLIC_SCANNER_PASSWORD=${ADMIN_PASS:-MaryMcHale}

# Mastra backend URL
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111
EOF
        echo "✅ Created cedar-mastra/.env with scanner credentials"
    fi
fi

# Clear Mastra build cache
echo "🧹 Clearing Mastra build cache..."
if [ -d "cedar-mastra/.mastra" ]; then
    rm -rf cedar-mastra/.mastra
    echo "✅ Cleared cedar-mastra/.mastra"
fi
if [ -d "cedar-mastra/src/backend/.mastra" ]; then
    rm -rf cedar-mastra/src/backend/.mastra
    echo "✅ Cleared cedar-mastra/src/backend/.mastra"
fi
# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down --remove-orphans

# Build scanner images first (required for scans to work)
echo "🔨 Building scanner images..."
docker compose --profile build-only build scanner zap

echo "🧹 Cleaning up unused Docker resources (images, containers, networks)..."
docker system prune -f

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
echo "💡 First time setup?"
echo "   If you need the pre-ingested database, run: ./database-restore.sh"
echo ""
echo "📝 Useful Commands:"
echo "   📋 View logs: docker compose logs -f"
echo "   🛑 Stop services: docker compose down"
echo "   🔄 Restart backend: docker compose restart web-api"
echo "   🔨 Rebuild scanner: docker compose --profile build-only build scanner"
echo "   💾 Backup database: ./database-dump.sh"
echo "   📥 Restore database: ./database-restore.sh"
echo ""
echo "🎨 Cedar Security Dashboard (Development Mode):"
echo "   The Cedar frontend and Mastra backend are included in docker-compose.yml"
echo "   but for DEVELOPMENT with hot-reload, run them manually:"
echo ""
echo "   📱 Cedar Frontend (Next.js):"
echo "      cd cedar-mastra && npm run dev:next"
echo "      Access at: http://localhost:3000"
echo ""
echo "   🤖 Mastra Backend (AI Agents):"
echo "      cd cedar-mastra && npm run dev:mastra"
echo "      API at: http://localhost:4111"
echo ""
echo "   🚀 Both Together (Recommended):"
echo "      cd cedar-mastra && npm run dev"
echo ""
echo "   ⚠️  Note: Cedar services use ports 3000 (frontend) and 4111 (Mastra)"
echo "           Scanner nginx also uses port 3000, so choose one or the other"
echo ""
echo "📊 To tail all logs, run:"
echo "   docker compose logs -f"