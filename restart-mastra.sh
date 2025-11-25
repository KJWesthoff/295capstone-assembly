#!/bin/bash

# restart-mastra.sh
# Script to rebuild and restart Cedar Mastra containers

set -e  # Exit on error

echo "=========================================="
echo "Restarting Mastra Docker Containers"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Clear Next.js cache to avoid stale builds
NEXT_CACHE_DIR="cedar-mastra/.next"
echo -e "${BLUE}Clearing Next.js cache at ${NEXT_CACHE_DIR}...${NC}"
if [ -d "$NEXT_CACHE_DIR" ]; then
  rm -rf "$NEXT_CACHE_DIR"
  echo -e "${GREEN}Next.js cache cleared.${NC}"
else
  echo -e "${YELLOW}No Next.js cache directory found (skipping).${NC}"
fi

# Stop existing containers
echo -e "${BLUE}Stopping existing Mastra containers...${NC}"
docker compose stop cedar-mastra cedar-frontend

# Remove containers (optional - forces rebuild)
echo -e "${BLUE}Removing containers...${NC}"
docker compose rm -f cedar-mastra cedar-frontend

# Rebuild images
echo -e "${BLUE}Rebuilding Mastra backend image...${NC}"
docker compose build cedar-mastra

echo -e "${BLUE}Rebuilding Cedar frontend image...${NC}"
docker compose build cedar-frontend

# Start containers
echo -e "${BLUE}Starting containers...${NC}"
docker compose up -d cedar-mastra cedar-frontend

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Check status
echo -e "${GREEN}Container status:${NC}"
docker compose ps cedar-mastra cedar-frontend

# Show logs
echo ""
echo -e "${GREEN}Recent logs:${NC}"
echo -e "${BLUE}=== Mastra Backend Logs ===${NC}"
docker compose logs --tail=20 cedar-mastra

echo ""
echo -e "${BLUE}=== Cedar Frontend Logs ===${NC}"
docker compose logs --tail=20 cedar-frontend

echo ""
echo -e "${GREEN}=========================================="
echo "Mastra containers restarted successfully!"
echo "==========================================${NC}"
echo ""
echo "Access points:"
echo "  - Cedar Frontend: http://localhost:3001"
echo "  - Mastra Backend: http://localhost:4111"
echo ""
echo "To view live logs:"
echo "  docker compose logs -f cedar-mastra"
echo "  docker compose logs -f cedar-frontend"
