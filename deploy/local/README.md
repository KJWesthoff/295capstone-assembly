# Local Development Setup

This directory contains scripts for running VentiAPI Scanner locally without AWS/Terraform.

## Quick Start

```bash
# Start core services (postgres, redis, web-api)
./start-local.sh

# With fresh Docker builds
./start-local.sh --build

# Start Cedar Dashboard (separate terminal)
cd cedar-mastra && bun run dev
```

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ with bun (for Cedar Dashboard)
- OpenAI API key (for AI features)

## Environment Setup

The `start-local.sh` script will create these files if they don't exist:

1. **`.env.local`** - Main scanner configuration
2. **`cedar-mastra/.env`** - Cedar/Mastra configuration

### Setting OpenAI API Key

```bash
# Option 1: Set before running script
export OPENAI_API_KEY=sk-proj-...
./start-local.sh

# Option 2: Edit cedar-mastra/.env directly
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Scanner API | http://localhost:8000 | FastAPI backend |
| Cedar Dashboard | http://localhost:3001 | Next.js + Cedar OS |
| Mastra Backend | http://localhost:4111 | AI agent framework |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

## Common Commands

```bash
# View logs
docker-compose logs -f web-api
docker-compose logs -f postgres

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
./start-local.sh --build

# Run a scan test
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "MICS295", "password": "MaryMcHale"}'
```

## Differences from Production

| Aspect | Local | Production (Terraform) |
|--------|-------|------------------------|
| Secrets | `.env` files | AWS Secrets Manager |
| Database | Docker PostgreSQL | Docker PostgreSQL (could be RDS) |
| URLs | localhost | Public IP |
| SSL | None | Should add via ALB/nginx |

## Troubleshooting

### Port already in use
```bash
lsof -i :8000
kill -9 <PID>
```

### Database connection issues
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### Cedar not connecting to Scanner API
Check `cedar-mastra/.env` has correct URLs:
```
NEXT_PUBLIC_SCANNER_SERVICE_URL=http://localhost:8000
```
