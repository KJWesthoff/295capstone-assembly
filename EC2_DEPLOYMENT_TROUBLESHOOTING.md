# EC2 Deployment Troubleshooting Guide

## Overview

This document details the issues encountered and solutions applied when deploying the VentiAPI Scanner dual-architecture platform to AWS EC2. The platform consists of two main components:

1. **Production Scanner (Docker Compose)**: React frontend + FastAPI backend + Python scanner engines
2. **Cedar Security Dashboard**: Next.js frontend + Cedar OS + Mastra AI backend

## Initial Deployment Status

**Working**: Local development environment with `./start-dev.sh`
**Goal**: Full EC2 deployment accessible via public IP
**Result**: Multiple inter-container communication and authentication issues

---

## Problem 1: Docker Compose Version Incompatibility

### Issue
```bash
unknown flag: --allow
docker: 'compose' is not a docker command
```

### Root Cause
- EC2 instance had Docker Compose v1 syntax
- Deployment script used v2 syntax (`docker compose` vs `docker-compose`)
- Build process used `--allow` flag not available in older Docker versions

### Solution
1. Updated `database-restore.sh` to use `docker-compose` instead of `docker compose`
2. Manually built Docker images instead of using docker-compose build
3. Used individual `docker build` commands to avoid version conflicts

**Files Modified**: `database-restore.sh`

---

## Problem 2: Missing Scanner Docker Images

### Issue
- Scanner functionality failed with "scanner image not found" errors
- Only PostgreSQL and Redis services were running
- VentiAPI and ZAP scanner images were missing

### Root Cause
- Deployment script failed to build scanner images due to Docker Compose compatibility issues
- Required images: `ventiapi-scanner`, `ventiapi-zap`, `ventiapi-nuclei`

### Solution
1. Manually built all scanner images:
   ```bash
   docker build -t ventiapi-scanner -f scanner.Dockerfile .
   docker build -t ventiapi-zap -f zap.Dockerfile .
   # nuclei uses public image: projectdiscovery/nuclei:latest
   ```
2. Verified scanner images functionality with `docker run --rm [image] --help`

**Images Built**: `ventiapi-scanner`, `ventiapi-zap`

---

## Problem 3: Container Networking and Service Discovery

### Issue
- Nginx couldn't find "web-api" service
- Container naming mismatches causing service discovery failures
- Services starting but unable to communicate

### Root Cause
- Manual container startup used different names than expected by nginx configuration
- Network configuration inconsistencies between services

### Solution
1. Standardized container naming:
   - `web-api` (not `ventiapi-web-api-manual`)
   - `cedar-frontend` and `cedar-mastra`
   - `nginx` for reverse proxy
2. Ensured all containers joined `ventiapi_scanner-network`
3. Used consistent Docker volume naming pattern

**Network**: `ventiapi_scanner-network`

---

## Problem 4: Security Group Port Configuration

### Issue
- Services not accessible from public internet
- Ports 4111 (Mastra backend) and 8000 (API) blocked

### Root Cause
- AWS security group only had ports 22, 3000, 3001, and 80 open
- Missing ports for web-api (8000) and Cedar Mastra backend (4111)

### Solution
```bash
aws ec2 authorize-security-group-ingress \
  --region us-west-1 \
  --group-id $SG_ID \
  --protocol tcp \
  --port 4111 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --region us-west-1 \
  --group-id $SG_ID \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0
```

**Ports Opened**: 4111, 8000

---

## Problem 5: Cedar Dashboard Hardcoded URLs

### Issue
- Cedar Dashboard showed "fallback scanner ui: http://localhost:3000"
- Should show public IP for external access

### Root Cause
- Hardcoded `localhost:3000` URL in `cedar-frontend/src/app/security/page.tsx`
- Next.js `NEXT_PUBLIC_*` variables not properly configured

### Solution
1. Updated source code to use public IP:
   ```bash
   sed 's|http://localhost:3000|http://52.53.43.122:3000|g' cedar-frontend/src/app/security/page.tsx
   ```
2. Rebuilt Cedar frontend with correct build arguments

**Files Modified**: `cedar-frontend/src/app/security/page.tsx`

---

## Problem 6: Docker Volume Prefix Mismatch

### Issue
```
File not found: /shared/specs/[scan_id]_VAmPI_API_Spec.json
```

### Root Cause
- Scanner containers looking for `scannerapp_shared-specs` volume
- Actual volume named `ventiapi_shared-specs`
- Volume prefix detection logic incorrect

### Solution
1. Fixed volume prefix in scanner engines:
   ```python
   # Before
   volume_prefix = options.get('volume_prefix', 'scannerapp')
   
   # After  
   volume_prefix = options.get('volume_prefix', 'ventiapi')
   ```
2. Updated main.py default volume prefix from `scannerapp` to `ventiapi`
3. Rebuilt and restarted web-api service

**Files Modified**: 
- `scanner-service/web-api/main.py`
- `scanner-service/web-api/scanner_engines.py`

---

## Problem 7: Cedar Mastra Authentication Missing

### Issue
- "Failed to authenticate with scanner service" from Cedar Dashboard
- Nuclei scanner not appearing dynamically

### Root Cause
- Cedar Mastra container missing `SCANNER_USERNAME` and `SCANNER_PASSWORD` environment variables
- Authentication failing for scanner API access

### Solution
1. Restarted Cedar Mastra with authentication credentials:
   ```bash
   docker run -d --name cedar-mastra \
     -e SCANNER_USERNAME=MICS295 \
     -e SCANNER_PASSWORD=MaryMcHale \
     -e SCANNER_SERVICE_URL=http://web-api:8000 \
     # ... other args
   ```

**Environment Variables Added**: `SCANNER_USERNAME`, `SCANNER_PASSWORD`

---

## Problem 8: CORS Configuration for Public IP

### Issue
- Cedar Dashboard JavaScript authentication failing
- Browser blocked requests from `52.53.43.122:3001` to `52.53.43.122:8000`

### Root Cause
- Web-API CORS only allowed localhost origins
- Missing EC2 public IP in allowed origins list

### Solution
1. Added EC2 origins to CORS configuration:
   ```bash
   docker run -d --name web-api \
     -e ADDITIONAL_CORS_ORIGINS='http://52.53.43.122:3001,http://52.53.43.122:3000' \
     # ... other args
   ```

**CORS Origins Added**: `http://52.53.43.122:3001`, `http://52.53.43.122:3000`

---

## Problem 9: Cedar Frontend Build-Time Environment Variables

### Issue
```javascript
// Console error
Failed to load scanners: TypeError: Failed to fetch
```

### Root Cause
- Cedar frontend authentication URLs still pointing to `localhost:8000`
- `NEXT_PUBLIC_SCANNER_API_URL` not properly embedded in built application
- Missing build argument in Dockerfile

### Solution
1. Updated Dockerfile to include missing build argument:
   ```dockerfile
   ARG NEXT_PUBLIC_SCANNER_API_URL=http://localhost:8000
   ENV NEXT_PUBLIC_SCANNER_API_URL=${NEXT_PUBLIC_SCANNER_API_URL}
   ```
2. Rebuilt with correct build arguments:
   ```bash
   docker build --build-arg NEXT_PUBLIC_SCANNER_API_URL=http://52.53.43.122:8000 \
     --build-arg NEXT_PUBLIC_SCANNER_SERVICE_URL=http://52.53.43.122:3000 \
     # ... other args
   ```

**Files Modified**: `cedar-frontend/Dockerfile.nextjs`

---

## Final Working Configuration

### Service Endpoints
- **Main Frontend (React)**: http://52.53.43.122:3000 ✅
- **Web API (FastAPI)**: http://52.53.43.122:8000 ✅  
- **Cedar Dashboard (Next.js)**: http://52.53.43.122:3001/security ✅
- **Cedar Mastra Backend**: http://52.53.43.122:4111 ✅

### Running Containers
```bash
CONTAINER ID   IMAGE                     COMMAND                  STATUS
nginx          nginx:alpine              "/docker-entrypoint.…"   Up
web-api        ventiapi-web-api-fixed    "uvicorn main:app --…"   Up  
cedar-frontend ventiapi-cedar-frontend-working "docker-entrypoint.s…" Up
cedar-mastra   ventiapi-cedar-mastra     "docker-entrypoint.s…"   Up
postgres       pgvector/pgvector:pg16    "docker-entrypoint.s…"   Up (healthy)
redis          redis:7-alpine            "docker-entrypoint.s…"   Up
```

### Scanner Engines Available
- ✅ **VentiAPI**: OWASP API Security Top 10 focused scanner
- ✅ **ZAP**: Comprehensive web application security scanner  
- ✅ **Nuclei**: Fast and customizable vulnerability scanner

### Authentication Flow
1. Cedar Dashboard auto-login with `MICS295:MaryMcHale`
2. JWT token obtained from `/api/auth/login`
3. Authenticated requests to `/api/scanners` return all 3 engines
4. Dynamic scanner discovery working in Cedar Dashboard

### RAG System Status
1. ✅ **OpenAI API Key**: Valid key configured in Cedar Mastra
2. ✅ **Database Connection**: PostgreSQL with pgvector for RAG storage
3. ✅ **AI Agent**: Security analyst agent responding to queries
4. ✅ **Chat Interface**: Streaming responses in Cedar Dashboard
5. ✅ **Context Awareness**: AI can reference scan results and security knowledge

---

## Key Lessons Learned

### 1. Next.js Build-Time vs Runtime Configuration
- `NEXT_PUBLIC_*` variables must be set at **build time**, not runtime
- Dockerfile must include all required build arguments and environment variables
- Container environment variables alone are insufficient for client-side JavaScript

### 2. Docker Volume Naming Consistency
- Volume prefix detection logic must match actual deployment environment
- Consistent naming patterns critical for multi-container applications
- Local development vs production environment differences require careful handling

### 3. CORS Configuration for Public Deployment
- Localhost CORS settings don't work for public IP deployment
- Must include all actual origins that will access the API
- Browser security requires explicit CORS configuration

### 4. Service Discovery in Docker Networks
- Container names must match configuration expectations
- Manual container startup requires careful naming consistency
- Network configuration affects inter-service communication

### 5. Authentication Chain Dependencies
- Missing environment variables can break entire authentication flow
- Cedar Dashboard requires both frontend and backend authentication configuration
- Dynamic content (like scanner lists) depends on successful authentication

### 6. AI/RAG System Configuration
- OpenAI API keys must be valid and properly scoped for the application
- Environment file precedence can override critical API configurations
- AI system failures often appear as empty responses rather than obvious errors
- RAG systems require both valid API keys AND proper database connections
- Silent failures in AI systems are harder to debug than explicit error messages

---

## Prevention Strategies

### 1. Environment-Aware Configuration
```python
# Good: Environment detection
volume_prefix = "ventiapi" if os.getenv("AWS_DEPLOYMENT") else "scannerapp"

# Better: Explicit configuration
volume_prefix = os.getenv("VOLUME_PREFIX", "scannerapp")
```

### 2. Comprehensive Build Arguments
```dockerfile
# Include all public environment variables as build args
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SERVICE_URL
ARG NEXT_PUBLIC_USERNAME
ARG NEXT_PUBLIC_PASSWORD

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# ... set all ENV vars
```

### 3. Deployment Validation Script
```bash
#!/bin/bash
# Validate all endpoints after deployment
endpoints=(
  "http://$PUBLIC_IP:3000"
  "http://$PUBLIC_IP:8000/health" 
  "http://$PUBLIC_IP:3001/security"
  "http://$PUBLIC_IP:4111/health"
)

for endpoint in "${endpoints[@]}"; do
  if curl -f "$endpoint" > /dev/null 2>&1; then
    echo "✅ $endpoint"
  else
    echo "❌ $endpoint"
  fi
done
```

### 4. Container Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:3000/health || exit 1
```

### 5. OpenAI API Key Management
```bash
# Good: Explicit environment variable override
docker run -d \
  --env-file .env.local \
  -e OPENAI_API_KEY=${ACTUAL_API_KEY} \
  container-name

# Better: Separate environment files
docker run -d \
  --env-file .env.secrets \
  --env-file .env.local \
  container-name

# Best: Use secrets management
docker run -d \
  --secret openai_api_key \
  -e OPENAI_API_KEY_FILE=/run/secrets/openai_api_key \
  container-name
```

### 6. Environment Variable Validation
```bash
#!/bin/bash
# Validate critical environment variables
required_vars=("OPENAI_API_KEY" "DATABASE_URL" "ADMIN_PASSWORD")

for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]] || [[ "${!var}" == *"placeholder"* ]] || [[ "${!var}" == *"your-"* ]]; then
    echo "❌ $var not properly configured"
    exit 1
  else
    echo "✅ $var configured"
  fi
done
```

---

## Problem 10: RAG System OpenAI API Key Configuration

### Issue
- Cedar Dashboard chat giving empty responses
- RAG system failing silently
- AI security analysis not working

### Root Cause
```javascript
// Console shows no visible errors, but backend logs show:
AI_APICallError: Incorrect API key provided: your-ope************here
finishReason: 'error'
```

- Cedar Mastra using placeholder API key from `.env.local`
- Valid OpenAI API key was in `cedar-frontend/.env` but not being used
- Environment file precedence overriding correct configuration

### Solution
1. **Identified Correct API Key**: Found valid key in `cedar-frontend/.env`
2. **Fixed Environment Variable Priority**:
   ```bash
   docker run -d --name cedar-mastra \
     --env-file .env.local \
     -e OPENAI_API_KEY=sk-proj-[actual-key] \
     # ... other args
   ```
3. **Verified Configuration**: Checked container has correct API key
4. **Tested RAG Functionality**: Confirmed AI responses working

**Files Involved**: `cedar-frontend/.env`, `.env.local`
**Environment Variables**: `OPENAI_API_KEY`

---

## Timeline Summary

1. **Initial Issue**: "Scan failed: Unknown error" + missing Nuclei scanner
2. **Investigation**: Discovered PostgreSQL, volume, and authentication issues  
3. **Docker Fixes**: Resolved Docker Compose compatibility and built missing images
4. **Network Fixes**: Fixed container naming and security group ports
5. **Authentication Fixes**: Added missing credentials and CORS configuration
6. **Frontend Fixes**: Fixed hardcoded URLs and build-time environment variables
7. **RAG System Fix**: Configured valid OpenAI API key for AI functionality
8. **Final Result**: Complete working deployment with all functionality including AI

**Total Resolution Time**: ~5 hours of systematic debugging
**Success Metrics**: All endpoints accessible, all scanners working, Cedar Dashboard fully functional, RAG AI system working