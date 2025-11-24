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
docker compose logs scanner  # Scanner container only
docker compose logs web-api  # Backend API only

# Stop services
docker compose down

# Rebuild scanner image (required after changing scanner code)
docker compose --profile build-only build scanner --no-cache

# Restart specific service
docker compose restart web-api

# Frontend only (development)
cd frontend
npm install
npm start

# Backend API only (for testing)
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

# Test scanner integration (separate terminal)
cd scanner-service
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

- **Frontend**: Next.js 15 app with Cedar OS integration for state management
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
- `cedar-mastra/src/app/`: Next.js pages including security dashboard at `/security`
- `cedar-mastra/src/app/cedar-os/`: Cedar state management and context
- `cedar-mastra/src/backend/src/mastra/agents/`: AI security analyst agents
- `cedar-mastra/src/backend/src/mastra/tools/`: Scanner bridge tools and RAG query tools
- `cedar-mastra/src/backend/src/mastra/workflows/`: Chat workflow and database workflows

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
- `OPENAI_API_KEY`: OpenAI API key for LLM (required)
- `SCANNER_SERVICE_URL`: URL to Python scanner API (default: http://localhost:8000)
- `DATABASE_URL`: PostgreSQL connection for RAG vector store (optional)

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

Check volume mismatch issues (common problem):
```bash
# List actual volumes created by Docker Compose
docker volume ls | grep shared

# Verify volume prefix in scanner_engines.py matches docker-compose.yml
grep "volume_prefix" scanner-service/web-api/scanner_engines.py
grep "shared-results" docker-compose.yml
```

### Working with Cedar Integration

Key files for Cedar/Mastra integration:
- `cedar-mastra/src/app/cedar-os/scanState.ts`: State management for scan results
- `cedar-mastra/src/backend/src/mastra/agents/securityAnalystAgent.ts`: Main AI agent
- `cedar-mastra/src/backend/src/mastra/tools/scannerBridgeTool.ts`: Scanner API integration
- `cedar-mastra/src/backend/src/mastra/workflows/chatWorkflow.ts`: Handles streaming chat with Cedar context
- `cedar-mastra/src/backend/src/mastra/index.ts`: Main Mastra configuration

When scan results change:
1. Update state shape in `scanState.ts`
2. Register state with `useCedarState` hook in React component
3. Agent automatically has access via Cedar context system (no manual serialization)
4. Test with Cedar DevTools (F12 → Cedar tab)

**Key Pattern**: Cedar OS automatically serializes registered state into agent context, so modifying `scanResults` in React immediately makes it available to Mastra agents.

### Working with Mastra Agents

Agents are defined in `cedar-mastra/src/backend/src/mastra/agents/`:
- `securityAnalystAgent.ts`: Main security analyst with OWASP expertise
- `productRoadmapAgent.ts`: Example roadmap agent (from starter template)

To modify agent behavior:
1. Edit agent instructions in the agent file
2. Add/remove tools from the agent's tool list
3. Restart Mastra backend: `bun run dev:mastra`
4. Test changes in Cedar chat UI

To add new tools:
1. Create tool file in `cedar-mastra/src/backend/src/mastra/tools/`
2. Define tool with Zod schema for parameters
3. Import and export in `index.ts`
4. Add tool to agent's available tools

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
See `SIMPLIFIED_K8S_ARCHITECTURE.md` for migration path
- Multi-namespace architecture
- Horizontal pod autoscaling
- Persistent volumes for results
- Prometheus/Grafana monitoring

## Common Issues

### "Scan Failed: Unknown error occurred"
- Usually means scanner container exhausted request budget
- Check scanner logs: `docker compose logs scanner`
- Increase `max_requests` parameter in scan settings
- See `development-log.md` for detailed fix explanation

### Frontend build fails
- Clear node_modules: `cd frontend && rm -rf node_modules && npm install`
- For Cedar prototype: Use `bun` instead of `npm`

### Scanner container fails to start
- Rebuild scanner image: `docker compose --profile build-only build scanner --no-cache`
- Check Docker socket permissions: `ls -la /var/run/docker.sock`
- Verify shared volumes exist: `docker volume ls | grep scanner`
- Check for volume name mismatches (see Debugging Scanner Issues)

### Redis connection errors
- Ensure Redis is running: `docker compose ps redis`
- Check Redis URL in `.env.local`
- Restart Redis: `docker compose restart redis`

### Cedar chat not appearing
- Check `.env` has valid `OPENAI_API_KEY`
- Verify Mastra backend running: `curl http://localhost:4111/health`
- Check browser console for errors
- Restart Mastra backend: `cd cedar-mastra && bun run dev:mastra`

### Mastra backend fails to start
- Check Node version >= 20.9.0
- Install dependencies: `cd cedar-mastra/src/backend && bun install`
- Check for port conflicts: `lsof -i :4111`

## Testing

### Frontend Tests (Production Scanner)
```bash
cd frontend
npm test
npm test -- --coverage
```

### Backend Tests
```bash
cd scanner-service/web-api
pytest
pytest -v  # verbose output
pytest tests/test_security.py  # specific test file
```

### Integration Tests
```bash
# Test scanner connectivity
./test-scanner-connection.sh

# View ZAP scan reports
./view-zap-reports.sh
```

### Manual Testing
```bash
# Test FastAPI directly
curl http://localhost:8000/api/health

# Test Mastra backend
curl http://localhost:4111/health

# Test scanner with sample spec
cd scanner-service
python venti_wrapper.py --spec openapi3.yml --server http://localhost:8080 --out results/test
```

## Critical Architecture Notes

### Docker Volume Mounting

The scanner uses shared volumes for spec files and results. Key considerations:
- **Local development**: Volume prefix determined by project directory name (e.g., `295capstone-assembly_`)
- **AWS deployment**: Volumes prefixed with `ventiapi_` instead
- **Volume detection**: `scanner-service/web-api/scanner_engines.py` contains `volume_prefix` parameter that MUST match docker-compose.yml
- Files written to `/shared/results/{scan_id}/` inside scanner container appear at `SHARED_RESULTS / scan_id` in web-api container

**IMPORTANT**: Volume mismatch is the #1 cause of "File not found" errors. Always verify:
1. `docker volume ls | grep shared` shows volumes exist
2. Volume names in `scanner_engines.py` match volume names in `docker-compose.yml`
3. See `development-log.md` for detailed troubleshooting

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
- Pattern used in `venti_wrapper.py` (lines 83-94) and `scanner-service/web-api/main.py` (lines 1127-1138)
- Frontend should handle this as normal scan completion

### Authentication Flow

Two separate auth systems:
1. **Production scanner**: JWT-based auth in `scanner-service/web-api/security.py` with admin/user roles
2. **Cedar dashboard**: No built-in auth (delegates to Mastra/Cedar OS patterns)

### Cedar Context System

Cedar OS provides automatic state serialization:
- Register state with `useCedarState` hook in React components
- State automatically appears in agent context
- No manual serialization or API calls needed
- Agents can @mention specific state entries
- Use Cedar DevTools (F12) to inspect registered states

### Database Integration (Future)

The project includes database setup for RAG:
- `database/init/` contains PostgreSQL with pgvector extension
- Intended for storing security knowledge embeddings (NIST, CVE, CWE)
- Not yet integrated with Cedar/Mastra pipeline
- See `docs/DATABASE_DISTRIBUTION.md` for details

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
- You can communicate with your code reviewer via the text files found in `.quibbler/`