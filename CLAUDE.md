# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VentiAPI Scanner is a dual-architecture API security testing platform with two distinct implementations:

1. **Production Scanner (Docker Compose)**: Full-stack security scanner with React frontend, FastAPI backend, and multiple scanner engines (VentiAPI, OWASP ZAP)
2. **Cedar Security Dashboard (Prototype)**: Next.js-based AI-powered security analyst dashboard integrating Cedar OS and Mastra for intelligent vulnerability analysis

Both systems share the underlying Python scanner service but serve different use cases.

## Quick Start Commands

### Production Scanner (Docker Compose)

```bash
# Start development environment (recommended)
./start-dev.sh

# Manual setup
cp .env.local.example .env.local
# Edit .env.local with credentials
docker compose --profile build-only build scanner
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild scanner image
docker compose --profile build-only build scanner

# Frontend only (development)
cd frontend
npm install
npm start

# Backend API only
cd scanner-service/web-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Cedar Security Dashboard (Prototype)

```bash
# Install dependencies (first time)
cd cedar-frontend-prototype
bun install
cd src/backend && bun install && cd ../..

# Start full stack (Next.js + Mastra backend)
bun run dev

# Start components separately
bun run dev:next    # Next.js on port 3000
bun run dev:mastra  # Mastra backend on port 4111
```

## Architecture Overview

### Production Scanner Architecture

Three-tier microservices architecture using Docker Compose:

- **Frontend Layer**: nginx reverse proxy serving React app (port 3000)
- **Backend Layer**: FastAPI web API (port 8000) + Redis cache (port 6379)
- **Scanner Layer**: Dynamically spawned Docker containers for VentiAPI and OWASP ZAP scanners

**Key Design Pattern**: The backend spawns ephemeral scanner containers via Docker socket (`/var/run/docker.sock`) with shared volumes for results and OpenAPI specs.

**Data Flow**:
1. User uploads OpenAPI spec via React frontend
2. FastAPI validates spec and creates scan job
3. Backend spawns scanner container with shared volumes
4. Scanner writes results to shared volume
5. Backend reads results and returns to frontend
6. Frontend displays real-time progress using TanStack Query polling

**Important Directories**:
- `frontend/src/components/`: React components for scan UI
- `scanner-service/web-api/`: FastAPI backend with authentication, rate limiting, and Docker orchestration
- `scanner-service/scanner/probes/`: Individual security test modules (BOLA, BFLA, injection, etc.)
- `venti_wrapper.py`: CLI wrapper for scanner with dangerous/fuzz options

### Cedar Security Dashboard Architecture

AI-native architecture using Cedar OS state management and Mastra RAG framework:

- **Frontend**: Next.js app with Cedar OS integration for state management
- **Backend**: Mastra framework providing AI agents, RAG pipeline, and tool execution
- **Integration Layer**: Scanner bridge tools connecting to existing Python scanner service

**Key Design Pattern**: Cedar OS registers application state (scan results, vulnerabilities) which AI agents can automatically access and modify through context system.

**Data Flow**:
1. Security dashboard displays vulnerability findings
2. User clicks vulnerability to add to Cedar context
3. Cedar agent receives context and queries Mastra RAG system
4. RAG retrieves relevant security knowledge (OWASP, MITRE, CVE data)
5. Agent generates analysis with code examples and remediation steps
6. Streaming response rendered in chat UI

**Important Directories**:
- `cedar-frontend-prototype/src/app/`: Next.js pages including security dashboard
- `cedar-frontend-prototype/src/app/cedar-os/`: Cedar state management and context
- `cedar-frontend-prototype/src/backend/src/mastra/agents/`: AI security analyst agents
- `cedar-frontend-prototype/src/backend/src/mastra/tools/`: Scanner bridge tools and RAG query tools

## Scanner Service Details

### Core Scanner Components

The Python scanner service (`scanner-service/`) uses a probe-based architecture:

**Probes** (`scanner/probes/`): Individual security test modules
- `bola.py`: Broken Object Level Authorization testing
- `bfla.py`: Broken Function Level Authorization testing
- `auth_matrix.py`: Authentication matrix testing
- `injection.py`: SQL/NoSQL/Command injection detection
- `mass_assign.py`: Mass assignment vulnerability testing
- `ratelimit.py`: Rate limiting validation
- `exposure.py`: Excessive data exposure detection
- `misconfig.py`: Security misconfiguration checks
- `inventory.py`: API inventory and discovery
- `logging.py`: Logging and monitoring validation

**Runtime** (`scanner/runtime/`): HTTP client, authentication, and throttling
**Analysis** (`scanner/analysis/`): OWASP API Top 10 mapping
**Report** (`scanner/report/`): JSON/HTML report generation

### Web API Security

The FastAPI backend implements comprehensive security controls in `scanner-service/web-api/
`:

- **Authentication**: JWT-based with configurable expiration
- **Authorization**: Role-based access control (admin/user)
- **Rate Limiting**: Per-endpoint limits using SlowAPI
- **Input Validation**: File upload validation, URL validation, path sanitization
- **Container Security**: Secure Docker command generation with resource limits

### Multi-Scanner Support

The system supports multiple scanner engines via `scanner-service/web-api/scanner_engines.py`:

- **VentiAPI**: Custom OWASP API Top 10 scanner (default)
- **OWASP ZAP**: Industry-standard baseline scanner
- **Nikto** (planned): Web server scanner

Each scanner runs in isolated Docker containers with shared result volumes.

## Environment Configuration

### Production Scanner

`.env.local` (from `.env.local.example`):
- `JWT_SECRET`: Secret key for JWT token signing
- `DEFAULT_ADMIN_USERNAME`: Admin username
- `DEFAULT_ADMIN_PASSWORD`: Admin password
- `REDIS_URL`: Redis connection string (default: redis://localhost:6379)
- `SCANNER_MAX_PARALLEL_CONTAINERS`: Limit concurrent scanner containers
- `SCANNER_CONTAINER_MEMORY_LIMIT`: Memory limit per container
- `SKIP_SCANNER_HEALTH_CHECK`: Skip container health checks in dev

### Cedar Dashboard

`cedar-frontend-prototype/.env`:
- `OPENAI_API_KEY`: OpenAI API key for LLM
- Database credentials for PostgreSQL RAG vector store (when integrated)

## Development Workflows

### Testing Scans Locally

1. Start services: `./start-dev.sh`
2. Access UI at http://localhost:3000
3. Login with credentials from `.env.local`
4. Upload OpenAPI spec or provide URL
5. Configure scan settings (dangerous mode, fuzz auth, max requests)
6. Monitor real-time progress
7. View results with severity breakdown

### Adding New Scanner Probes

1. Create probe file in `scanner-service/scanner/probes/`
2. Implement async probe function following pattern:
   ```python
   async def run(spec, client, auth_ctx):
       findings = []
       # Test logic here
       return findings
   ```
3. Import probe in `venti_wrapper.py`
4. Add probe to execution list in `run_scan()`

### Debugging Scanner Issues

Check scanner container logs:
```bash
docker compose logs scanner
docker compose logs web-api
```

Test scanner directly:
```bash
cd scanner-service
python -m scanner.cli --spec openapi3.yml --server http://localhost:8080 --out results/
```

View shared volumes:
```bash
docker compose exec web-api ls -la /shared/results/
docker compose exec web-api ls -la /shared/specs/
```

### Working with Cedar Integration

Key files for Cedar/Mastra integration:
- `cedar-frontend-prototype/src/app/cedar-os/scanState.ts`: State management for scan results
- `cedar-frontend-prototype/src/backend/src/mastra/agents/securityAnalystAgent.ts`: Main AI agent
- `cedar-frontend-prototype/src/backend/src/mastra/tools/scannerBridgeTool.ts`: Scanner API integration

When scan results change:
1. Update state shape in `scanState.ts`
2. Register state with `useCedarState` hook
3. Agent automatically has access via Cedar context system
4. No manual serialization required

## Deployment

### Local Development
Use Docker Compose (see Quick Start)

### AWS EC2 (Current Production)
See deployment guides for complete instructions:
- **`EC2_DEPLOYMENT_CHECKLIST.md`**: Step-by-step deployment procedures and validation
- **`EC2_DEPLOYMENT_TROUBLESHOOTING.md`**: Common issues and systematic fixes
- **`AWS_DEPLOYMENT.md`**: Complete deployment guide
- Deployed at http://54.241.100.240:3000
- Uses docker-compose.yml on EC2 instance
- nginx reverse proxy on port 3000

### Kubernetes (Future)
See `ARCHITECTURE_COMPARISON.md` for migration path
- Multi-namespace architecture
- Horizontal pod autoscaling
- Persistent volumes for results
- Prometheus/Grafana monitoring

## Common Issues

### "Scan Failed: Unknown error occurred"
- Usually means scanner container exhausted request budget
- Check scanner logs: `docker compose logs scanner`
- Increase `max_requests` parameter in scan settings

### Frontend build fails
- Clear node_modules: `cd frontend && rm -rf node_modules && npm install`
- For Cedar prototype: Use `bun` instead of `npm`

### Scanner container fails to start
- Rebuild scanner image: `docker compose --profile build-only build scanner`
- Check Docker socket permissions: `ls -la /var/run/docker.sock`
- Verify shared volumes exist: `docker volume ls | grep scanner`

### Redis connection errors
- Ensure Redis is running: `docker compose ps redis`
- Check Redis URL in `.env.local`

## Testing

### Frontend Tests
```bash
cd frontend
npm test
npm test -- --coverage
```

### Backend Tests
```bash
cd scanner-service/web-api
pytest
```

### Integration Tests
See `test-scanner-connection.sh` for scanner connectivity tests

## Additional Documentation

- `README.md`: Quick start and overview
- `START_HERE.md`: Cedar dashboard quick start
- `SPIKE_CEDEROS_INTEGRATION.md`: Detailed Cedar/Mastra integration design
- `ARCHITECTURE_COMPARISON.md`: MVP vs Production architecture comparison

### Deployment Documentation
- `AWS_DEPLOYMENT.md`: AWS deployment guide
- `EC2_DEPLOYMENT_CHECKLIST.md`: Complete deployment checklist and procedures
- `EC2_DEPLOYMENT_TROUBLESHOOTING.md`: Troubleshooting guide with 10+ common issues and fixes

### Configuration and Security
- `SECURITY.md`: Security implementation details
- `SECRETS.md`: Secrets management guide
- `MULTI_SCANNER_GUIDE.md`: Multi-scanner configuration
- `development-log.md`: Recent fixes and changes
