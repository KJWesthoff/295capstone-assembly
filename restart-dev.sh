#!/bin/bash

# VentiAPI Scanner - Quick Restart for Code Changes
# Use this script when you make code changes (doesn't rebuild images)

set -e

SERVICE="${1:-all}"

# Clear Mastra build cache function
clear_mastra_cache() {
    echo "🧹 Clearing Mastra build cache..."
    if [ -d "cedar-frontend/.mastra" ]; then
        rm -rf cedar-frontend/.mastra
        echo "✅ Cleared cedar-frontend/.mastra"
    fi
    if [ -d "cedar-frontend/src/backend/.mastra" ]; then
        rm -rf cedar-frontend/src/backend/.mastra
        echo "✅ Cleared cedar-frontend/src/backend/.mastra"
    fi
}

echo "🔄 Restarting VentiAPI Scanner services..."

case "$SERVICE" in
    "api"|"backend"|"web-api")
        echo "🔄 Restarting scanner API backend..."
        docker compose restart web-api
        echo "✅ Scanner API restarted"
        ;;
    "frontend"|"react")
        echo "🔄 Restarting React frontend..."
        docker compose restart frontend nginx
        echo "✅ React frontend restarted"
        ;;
    "cedar-frontend")
        echo "🔄 Restarting Cedar frontend..."
        docker compose restart cedar-frontend
        echo "✅ Cedar frontend restarted"
        ;;
    "cedar-mastra"|"mastra")
        echo "🔄 Restarting Mastra backend..."
        clear_mastra_cache
        docker compose restart cedar-mastra
        echo "✅ Mastra backend restarted"
        ;;
    "cedar"|"cedar-all")
        echo "🔄 Restarting Cedar stack (frontend + mastra)..."
        clear_mastra_cache
        docker compose restart cedar-frontend cedar-mastra
        echo "✅ Cedar stack restarted"
        ;;
    "db"|"postgres")
        echo "🔄 Restarting PostgreSQL..."
        docker compose restart postgres
        echo "✅ PostgreSQL restarted"
        ;;
    "all")
        echo "🔄 Restarting all services..."
        clear_mastra_cache
        docker compose restart
        echo "✅ All services restarted"
        ;;
    *)
        echo "❌ Unknown service: $SERVICE"
        echo ""
        echo "Usage: ./restart-dev.sh [service]"
        echo ""
        echo "Services:"
        echo "  api, backend, web-api    - Scanner API backend"
        echo "  frontend, react          - React frontend"
        echo "  cedar-frontend           - Cedar Next.js frontend"
        echo "  cedar-mastra, mastra     - Mastra AI backend"
        echo "  cedar, cedar-all         - Both Cedar services"
        echo "  db, postgres             - PostgreSQL database"
        echo "  all                      - All services (default)"
        exit 1
        ;;
esac

echo ""
echo "📊 Container Status:"
docker compose ps

echo ""
echo "💡 View logs: docker compose logs -f ${SERVICE}"
