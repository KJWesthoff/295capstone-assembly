# EC2 Deployment Checklist

## Pre-Deployment Validation

### 1. Local Environment Verification
- [ ] `./start-dev.sh` works completely
- [ ] All scanners (VentiAPI, ZAP, Nuclei) appear and function
- [ ] Cedar Dashboard authentication working
- [ ] RAG chat system providing AI responses
- [ ] Scan results appearing in both frontends

### 2. Environment Configuration Review
- [ ] `.env.local` has valid admin credentials (not defaults)
- [ ] `cedar-frontend/.env` has valid OpenAI API key (not placeholder)
- [ ] All database credentials are production-ready
- [ ] No placeholder values in any environment files

### 3. Build Arguments Validation
```bash
# Verify all required build arguments are defined
grep -r "ARG NEXT_PUBLIC" cedar-frontend/Dockerfile.nextjs
grep -r "ENV NEXT_PUBLIC" cedar-frontend/Dockerfile.nextjs
```

---

## AWS Infrastructure Setup

### 1. Security Group Configuration
Required ports:
- [ ] 22 (SSH)
- [ ] 3000 (Main Frontend)
- [ ] 3001 (Cedar Dashboard)
- [ ] 4111 (Cedar Mastra Backend)
- [ ] 8000 (Web API)
- [ ] 54320 (PostgreSQL - optional for external access)

### 2. EC2 Instance Requirements
- [ ] Instance type: t3.medium or larger
- [ ] Storage: 30GB+ EBS volume
- [ ] AMI: Amazon Linux 2023
- [ ] Key pair configured and accessible

### 3. Docker Environment Setup
```bash
# Verify Docker versions after EC2 setup
docker --version          # Should be 20.10+
docker-compose --version  # Should be v2.0+
```

---

## Deployment Process

### 1. File Upload and Initial Setup
```bash
# Upload code
rsync -av --exclude='.git' --exclude='node_modules' . ec2-user@$EC2_IP:/opt/ventiapi/

# Set up environment files
cp .env.local.example .env.local
# Edit .env.local with production values
```

### 2. Docker Image Building
```bash
# Build in correct order to avoid dependencies
docker build -t ventiapi-web-api ./scanner-service/web-api/
docker build -t ventiapi-scanner -f scanner.Dockerfile .
docker build -t ventiapi-zap -f zap.Dockerfile .

# Build Cedar images with correct build arguments
docker build -f cedar-frontend/Dockerfile.nextjs \
  --build-arg NEXT_PUBLIC_SCANNER_API_URL=http://$EC2_IP:8000 \
  --build-arg NEXT_PUBLIC_SCANNER_SERVICE_URL=http://$EC2_IP:3000 \
  --build-arg NEXT_PUBLIC_SCANNER_USERNAME=MICS295 \
  --build-arg NEXT_PUBLIC_SCANNER_PASSWORD=MaryMcHale \
  -t ventiapi-cedar-frontend ./cedar-frontend/

docker build -f cedar-frontend/Dockerfile.mastra \
  -t ventiapi-cedar-mastra ./cedar-frontend/
```

### 3. Network and Volume Setup
```bash
# Create Docker network
docker network create ventiapi_scanner-network

# Create volumes
docker volume create ventiapi_shared-results
docker volume create ventiapi_shared-specs
docker volume create ventiapi_postgres-data
docker volume create ventiapi_redis-data
```

### 4. Service Startup (Correct Order)
```bash
# 1. Start PostgreSQL first
docker run -d --name postgres \
  --network ventiapi_scanner-network \
  -p 54320:5432 \
  -e POSTGRES_USER=rag_user \
  -e POSTGRES_PASSWORD=rag_pass \
  -e POSTGRES_DB=rag_db \
  -v ventiapi_postgres-data:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# 2. Start Redis
docker run -d --name redis \
  --network ventiapi_scanner-network \
  -p 6379:6379 \
  -v ventiapi_redis-data:/data \
  redis:7-alpine

# 3. Start Web API
docker run -d --name web-api \
  --network ventiapi_scanner-network \
  -p 8000:8000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ventiapi_shared-results:/shared/results \
  -v ventiapi_shared-specs:/shared/specs \
  --env-file .env.local \
  -e ADDITIONAL_CORS_ORIGINS=http://$EC2_IP:3001,http://$EC2_IP:3000 \
  ventiapi-web-api

# 4. Start Frontend (build step)
docker run -d --name frontend \
  --network ventiapi_scanner-network \
  -v ventiapi_frontend-build:/shared \
  ventiapi-frontend

# 5. Start Nginx
docker run -d --name nginx \
  --network ventiapi_scanner-network \
  -p 3000:80 \
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf \
  -v ventiapi_frontend-build:/usr/share/nginx/html \
  nginx:alpine

# 6. Start Cedar Mastra Backend
docker run -d --name cedar-mastra \
  --network ventiapi_scanner-network \
  -p 4111:4111 \
  --env-file .env.local \
  -e SCANNER_SERVICE_URL=http://web-api:8000 \
  -e SCANNER_USERNAME=MICS295 \
  -e SCANNER_PASSWORD=MaryMcHale \
  -e DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NODE_ENV=production \
  ventiapi-cedar-mastra

# 7. Start Cedar Frontend
docker run -d --name cedar-frontend \
  --network ventiapi_scanner-network \
  -p 3001:3000 \
  --env-file .env.local \
  -e MASTRA_API_URL=http://cedar-mastra:4111 \
  -e SCANNER_SERVICE_URL=http://web-api:8000 \
  -e NODE_ENV=production \
  ventiapi-cedar-frontend
```

---

## Post-Deployment Validation

### 1. Service Health Checks
```bash
# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test endpoints
curl -f http://$EC2_IP:3000 || echo "❌ Main Frontend"
curl -f http://$EC2_IP:8000/health || echo "❌ Web API"
curl -f http://$EC2_IP:3001/security || echo "❌ Cedar Dashboard"
curl -f http://$EC2_IP:4111 || echo "❌ Cedar Mastra"
```

### 2. Authentication Testing
```bash
# Test scanner API authentication
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"MICS295","password":"MaryMcHale"}' \
  http://$EC2_IP:8000/api/auth/login

# Test scanner discovery
curl -u MICS295:MaryMcHale http://$EC2_IP:8000/api/scanners
```

### 3. Scanner Functionality Testing
```bash
# Test scanner images
docker run --rm ventiapi-scanner --help
docker run --rm ventiapi-zap --help
docker run --rm projectdiscovery/nuclei:latest --help
```

### 4. RAG System Testing
- [ ] Visit Cedar Dashboard chat interface
- [ ] Send test message to AI agent
- [ ] Verify streaming responses (not empty)
- [ ] Check Mastra backend logs for OpenAI API calls

---

## Common Issues and Quick Fixes

### Issue: "Failed to fetch" in Cedar Dashboard
**Quick Fix**: Check CORS configuration
```bash
docker logs web-api | grep CORS
# Restart with CORS fix if needed
docker restart web-api
```

### Issue: Scanner containers can't find spec files
**Quick Fix**: Check volume prefix
```bash
docker exec web-api ls -la /shared/specs/
# If empty, check volume_prefix in scanner_engines.py
```

### Issue: Empty RAG responses
**Quick Fix**: Check OpenAI API key
```bash
docker exec cedar-mastra printenv | grep OPENAI_API_KEY
# If placeholder, restart with correct key
```

### Issue: Authentication failures
**Quick Fix**: Check credentials match
```bash
docker exec cedar-mastra printenv | grep SCANNER_
# Verify SCANNER_USERNAME and SCANNER_PASSWORD are set
```

---

## Rollback Procedures

### 1. Container-Level Rollback
```bash
# Stop problematic container
docker stop $CONTAINER_NAME

# Revert to previous image
docker run -d --name $CONTAINER_NAME \
  [previous working configuration]
```

### 2. Complete Stack Rollback
```bash
# Stop all services
docker stop $(docker ps -q)
docker rm $(docker ps -aq)

# Restart with known good configuration
# [Re-run deployment steps]
```

### 3. Network Reset
```bash
# If networking issues persist
docker network rm ventiapi_scanner-network
docker network create ventiapi_scanner-network
# Restart all containers
```

---

## Monitoring and Maintenance

### 1. Log Monitoring
```bash
# Key logs to watch
docker logs -f web-api          # API requests and errors
docker logs -f cedar-mastra     # AI/RAG system status
docker logs -f nginx            # Frontend access logs
```

### 2. Health Monitoring Script
```bash
#!/bin/bash
# health-check.sh
endpoints=(
  "http://$EC2_IP:3000"
  "http://$EC2_IP:8000/health"
  "http://$EC2_IP:3001/security"
  "http://$EC2_IP:4111"
)

for endpoint in "${endpoints[@]}"; do
  if curl -f "$endpoint" > /dev/null 2>&1; then
    echo "✅ $(date): $endpoint"
  else
    echo "❌ $(date): $endpoint - FAILED"
    # Alert or restart logic here
  fi
done
```

### 3. Resource Usage Monitoring
```bash
# Container resource usage
docker stats --no-stream

# Disk usage
docker system df

# Network connectivity
docker network inspect ventiapi_scanner-network
```

---

## Security Considerations

### 1. API Key Management
- [ ] OpenAI API key has appropriate usage limits
- [ ] API keys are not logged in container output
- [ ] Regular rotation of API keys scheduled

### 2. Network Security
- [ ] Security group rules are minimal and specific
- [ ] Internal container communication uses internal hostnames
- [ ] No sensitive data in container logs

### 3. Data Protection
- [ ] Database passwords are strong and unique
- [ ] Scan results are properly isolated
- [ ] No hardcoded credentials in built images

---

## Emergency Contacts and Resources

### Documentation
- **Troubleshooting Guide**: `EC2_DEPLOYMENT_TROUBLESHOOTING.md`
- **Architecture Overview**: `CLAUDE.md`
- **Local Development**: `README.md`

### Key Commands Reference
```bash
# Quick status check
docker ps --format "table {{.Names}}\t{{.Status}}"

# View all logs
docker logs --tail 50 $(docker ps -q)

# Complete restart
docker-compose down && docker-compose up -d

# Emergency stop
docker stop $(docker ps -q)
```