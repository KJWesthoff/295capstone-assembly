# Cedar Frontend Deployment Guide

Simple deployment instructions for adding Cedar OS dashboard to the existing VentiAPI Scanner infrastructure.

## Quick Start

Cedar has been integrated into the existing Docker Compose setup. No infrastructure changes needed!

### 1. Configure Environment

Make sure your Cedar environment file has the required API keys:

```bash
cd cedar-frontend
cp .env .env.local  # If you need to override any settings
```

Edit `.env` to add your OpenAI API key:
```
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

### 2. Build and Start

From the **project root** (not cedar-frontend):

```bash
# Build all services including Cedar
docker compose build

# Start everything (includes existing scanner + new Cedar services)
docker compose up -d
```

Or use the existing start script which now includes Cedar:

```bash
./start-dev.sh
```

### 3. Access the Applications

- **Original Scanner Frontend**: http://localhost:3000 (unchanged)
- **Cedar Dashboard**: http://localhost:3001 (new)
- **Mastra AI Backend**: http://localhost:4111 (new)
- **Scanner API**: http://localhost:8000 (unchanged)

## What Was Added

Two new services were added to `docker-compose.yml`:

1. **cedar-frontend** - Next.js app with Cedar OS on port 3001
2. **cedar-mastra** - AI agent backend on port 4111

Both integrate seamlessly with the existing scanner infrastructure via internal Docker networking.

## Architecture

```
┌─────────────────────────────────────┐
│   Existing Infrastructure           │
│   - nginx (port 3000)                │
│   - web-api (port 8000)              │
│   - redis (port 6379)                │
│   - scanner containers               │
└──────────────┬──────────────────────┘
               │
               │ (internal network)
               │
┌──────────────▼──────────────────────┐
│   Cedar Services (New)               │
│   - cedar-frontend (port 3001)       │
│   - cedar-mastra (port 4111)         │
└─────────────────────────────────────┘
```

## Development Workflow

### Running Cedar in Development Mode

If you want to develop Cedar separately from the scanner:

```bash
cd cedar-frontend
bun install
bun run dev
```

This runs:
- Next.js on http://localhost:3000
- Mastra on http://localhost:4111

### Rebuilding After Changes

```bash
# Rebuild just Cedar services
docker compose build cedar-frontend cedar-mastra

# Restart Cedar services
docker compose restart cedar-frontend cedar-mastra
```

## Troubleshooting

### Cedar services won't start

Check the environment file:
```bash
cat cedar-frontend/.env
```

Make sure `OPENAI_API_KEY` is set.

### Port conflicts

If port 3001 or 4111 are in use, edit `docker-compose.yml`:

```yaml
cedar-frontend:
  ports:
    - "3002:3000"  # Change 3001 to any available port
```

### Can't connect to scanner API

The services use internal Docker networking. From inside containers:
- Scanner API: `http://web-api:8000`
- Redis: `http://redis:6379`

### View logs

```bash
# All Cedar logs
docker compose logs -f cedar-frontend cedar-mastra

# Just frontend
docker compose logs -f cedar-frontend

# Just backend
docker compose logs -f cedar-mastra
```

## Stopping Services

```bash
# Stop everything
docker compose down

# Stop just Cedar (keep scanner running)
docker compose stop cedar-frontend cedar-mastra
```

## Production Deployment

Cedar services are included in the existing deployment process. Just use the same AWS/Railway deployment scripts as before - they'll automatically include Cedar.

The services will be available at:
- Cedar Dashboard: `http://YOUR_IP:3001`
- Mastra API: `http://YOUR_IP:4111`

Consider adding them to your reverse proxy/ingress configuration if needed.

## Integration Points

Cedar integrates with existing infrastructure through:

1. **Scanner API** - Fetches scan results and vulnerability data
2. **Shared Network** - All containers on `scanner-network`
3. **Environment Variables** - Configured via `.env` files
4. **No Database Changes** - Cedar uses its own storage via Mastra

No changes were made to:
- Existing frontend (still on port 3000)
- Scanner service
- Redis configuration
- Database schemas
