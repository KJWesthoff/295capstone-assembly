# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VentiAPI Scanner is a dual-architecture API security testing platform targeting OWASP API Security Top 10 vulnerabilities:

1. **Production Scanner (Docker Compose)**: React + FastAPI + Python scanner with multi-engine support (VentiAPI, OWASP ZAP)
2. **Cedar Security Dashboard (Next.js)**: AI-powered security analyst using Cedar OS state management and Mastra RAG framework

Both share the Python scanner service (`scanner-service/`) but target different use cases: production scanning vs. AI-assisted vulnerability analysis.

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

### Cedar Security Dashboard

```bash
# Install dependencies (first time)
cd cedar-mastra
bun install
cd src/backend && bun install && cd ../..

# Start full stack (Next.js + Mastra backend)
bun run dev

# Start components separately
bun run dev:next    # Next.js on port 3000
bun run dev:mastra  # Mastra backend on port 4111

# Test scanner integration
cd /Users/jesse/x/295capstone-assembly/scanner-service
python -m uvicorn web-api.main:app --reload --port 8000
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
- `cedar-mastra/src/app/`: Next.js pages including security dashboard
- `cedar-mastra/src/app/cedar-os/`: Cedar state management and context
- `cedar-mastra/src/backend/src/mastra/agents/`: AI security analyst agents
- `cedar-mastra/src/backend/src/mastra/tools/`: Scanner bridge tools and RAG query tools

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

The FastAPI backend implements comprehensive security controls in `scanner-service/web-api/security.py`:

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

`cedar-mastra/.env`:
- `OPENAI_API_KEY`: OpenAI API key for LLM
- `SCANNER_SERVICE_URL`: URL to Python scanner API (default: http://localhost:8000)
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
- `cedar-mastra/src/app/cedar-os/scanState.ts`: State management for scan results
- `cedar-mastra/src/backend/src/mastra/agents/securityAnalystAgent.ts`: Main AI agent
- `cedar-mastra/src/backend/src/mastra/tools/scannerBridgeTool.ts`: Scanner API integration
- `cedar-mastra/src/backend/src/mastra/workflows/chatWorkflow.ts`: Handles streaming chat with Cedar context

When scan results change:
1. Update state shape in `scanState.ts`
2. Register state with `useCedarState` hook in React component
3. Agent automatically has access via Cedar context system (no manual serialization)
4. Test with Cedar DevTools (F12 → Cedar tab)

**Key Pattern**: Cedar OS automatically serializes registered state into agent context, so modifying `scanResults` in React immediately makes it available to Mastra agents.

## Deployment

### Local Development
Use Docker Compose (see Quick Start)

### AWS EC2 (Current Production)
See `AWS_DEPLOYMENT.md` for complete instructions
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

## Critical Architecture Notes

### Docker Volume Mounting

The scanner uses shared volumes for spec files and results. Key considerations:
- **Production scanner**: Volumes named `295capstone-assembly_shared-results` and `295capstone-assembly_shared-specs`
- **AWS deployment**: Volumes prefixed with `ventiapi_` instead
- **scanner-service/web-api/scanner_engines.py**: Contains volume detection logic (`volume_prefix` parameter)
- Files written to `/shared/results/{scan_id}/` inside scanner container appear at `SHARED_RESULTS / scan_id` in web-api container

### Multi-Scanner Execution

The system supports parallel scanning with multiple engines:
- **VentiAPI scanner**: API-specific testing (BOLA, BFLA, mass assignment, injection)
- **OWASP ZAP scanner**: Baseline security scan (XSS, security headers, cookies)
- Execution handled by `scanner_engines.py` via `run_parallel_scan()`
- Each scanner runs in isolated Docker container with resource limits
- Results aggregated and attributed to specific scanner engine

### Request Budget Pattern

Scanners have a configurable request budget (`max_requests` parameter):
- When budget exhausted, scanner exits with "request budget exhausted" message
- **This is NOT an error** - web-api treats it as successful completion
- Pattern used in `venti_wrapper.py` line 83-94 and `scanner-service/web-api/main.py` line 1127-1138
- Frontend should handle this as normal scan completion

### Authentication Flow

Two separate auth systems:
1. **Production scanner**: JWT-based auth in `scanner-service/web-api/security.py` with admin/user roles
2. **Cedar dashboard**: No built-in auth (delegates to Mastra/Cedar OS patterns)

## Additional Documentation

- `README.md`: Quick start and overview
- `START_HERE.md`: Cedar dashboard quick start guide
- `QUICKSTART_CEDAR.md`: Cedar integration step-by-step setup
- `AWS_DEPLOYMENT.md`: AWS EC2 deployment instructions
- `development-log.md`: Recent bug fixes and changes
- See inline documentation in `scanner-service/web-api/main.py` for API endpoint details
