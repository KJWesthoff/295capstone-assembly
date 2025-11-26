#!/bin/bash
# =============================================================================
# VentiAPI Scanner - Local Development Startup
# =============================================================================
# This script starts all services locally for development.
# No Terraform or AWS required - just Docker.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== VentiAPI Scanner - Local Development ===${NC}"
echo ""

# =============================================================================
# Check Prerequisites
# =============================================================================

echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# =============================================================================
# Setup Environment Files
# =============================================================================

echo "Setting up environment files..."

# Create .env.local if it doesn't exist
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    cat > "$PROJECT_ROOT/.env.local" << 'EOF'
# =============================================================================
# Local Development Environment
# =============================================================================

# Security
JWT_SECRET=local-dev-jwt-secret-not-for-production
ADMIN_USERNAME=MICS295
ADMIN_PASSWORD=MaryMcHale

# Environment
ENVIRONMENT=development
DEBUG=true

# Redis
REDIS_URL=redis://redis:6379

# Database
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

# Scanner
SCANNER_IMAGE=ventiapi-scanner
ZAP_IMAGE=ventiapi-zap

# Logging
LOG_LEVEL=DEBUG
LOG_FORMAT=json
EOF
    echo -e "${GREEN}✓ Created .env.local${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

# Create cedar-mastra/.env if it doesn't exist
if [ ! -f "$PROJECT_ROOT/cedar-mastra/.env" ]; then
    echo -e "${YELLOW}Creating cedar-mastra/.env...${NC}"

    # Check for OpenAI API key
    if [ -z "$OPENAI_API_KEY" ]; then
        echo -e "${YELLOW}Warning: OPENAI_API_KEY not set in environment${NC}"
        echo "Set it with: export OPENAI_API_KEY=sk-proj-..."
        OPENAI_API_KEY="YOUR_OPENAI_API_KEY_HERE"
    fi

    cat > "$PROJECT_ROOT/cedar-mastra/.env" << EOF
# =============================================================================
# Cedar/Mastra - Local Development
# =============================================================================

# OpenAI (REQUIRED)
OPENAI_API_KEY=$OPENAI_API_KEY
MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db?sslmode=disable
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

# Scanner Service (local)
SCANNER_SERVICE_URL=http://localhost:8000
SCANNER_USERNAME=MICS295
SCANNER_PASSWORD=MaryMcHale

# Public URLs (localhost for dev)
NEXT_PUBLIC_SCANNER_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_SCANNER_USERNAME=MICS295
NEXT_PUBLIC_SCANNER_PASSWORD=MaryMcHale
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111
EOF
    echo -e "${GREEN}✓ Created cedar-mastra/.env${NC}"
else
    echo -e "${GREEN}✓ cedar-mastra/.env already exists${NC}"
fi

echo ""

# =============================================================================
# Start Services
# =============================================================================

cd "$PROJECT_ROOT"

echo "Starting services..."
echo ""

# Check if we should build first
if [ "$1" == "--build" ] || [ "$1" == "-b" ]; then
    echo "Building Docker images..."
    docker-compose build
    docker-compose --profile build-only build scanner || true
    docker-compose --profile build-only build zap || true
    echo ""
fi

# Start core services
echo "Starting core services (postgres, redis, web-api)..."
docker-compose up -d postgres redis web-api

# Wait for postgres
echo "Waiting for PostgreSQL..."
sleep 5
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose exec -T postgres pg_isready -U rag_user -d rag_db > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

# Run migrations if needed
if [ -f "database/init/01-create-scanner-schema.sql" ]; then
    echo "Running database migrations..."
    docker-compose exec -T postgres psql -U rag_user -d rag_db < database/init/01-create-scanner-schema.sql 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}=== Core Services Started ===${NC}"
echo ""
echo "  Scanner API: http://localhost:8000"
echo "  PostgreSQL:  localhost:5432"
echo "  Redis:       localhost:6379"
echo ""
echo -e "${YELLOW}To start Cedar Dashboard (in separate terminal):${NC}"
echo "  cd cedar-mastra && bun run dev"
echo ""
echo -e "${YELLOW}To start Production Frontend (optional):${NC}"
echo "  docker-compose up -d frontend"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "  docker-compose logs -f web-api"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo "  docker-compose down"
echo ""
