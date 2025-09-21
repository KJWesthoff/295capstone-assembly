# VentiAPI Scanner - Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the VentiAPI Scanner in a Kubernetes cluster.

## Quick Start

### Option 1: Automated Deployment (Recommended)

```bash
# Deploy everything with one command
./kubernetes/deploy.sh
```

### Option 2: Manual Deployment

```bash
# 1. Build Docker images (for local development)
docker build -t ventiapi-frontend:latest ./frontend
docker build -t ventiapi-web-api:latest ./scanner-service/web-api
docker build -t ventiapi-scanner:latest -f scanner.Dockerfile .

# 2. Import images to k3d (if using k3d)
k3d image import ventiapi-frontend:latest -c ventiapi-local
k3d image import ventiapi-web-api:latest -c ventiapi-local
k3d image import ventiapi-scanner:latest -c ventiapi-local

# 3. Apply Kubernetes manifests
kubectl apply -k ./kubernetes/

# 4. Wait for deployment
kubectl wait --for=condition=available --timeout=300s deployment --all -n ventiapi
```

## Architecture

The Kubernetes deployment consists of:

- **Namespace**: `ventiapi` - Isolated namespace for all resources
- **Redis**: In-memory data store for scan results and job queue
- **Web API**: FastAPI backend that manages scans and creates Kubernetes Jobs
- **Frontend**: React.js UI served by Nginx with API proxying
- **Service Account**: RBAC permissions for creating and managing scanner Jobs

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 30000 | React UI (NodePort) |
| web-api | 30001 | API Backend (NodePort) |
| redis | 6379 | Redis (ClusterIP) |

## Accessing the Application

### With k3d (Local Development)
- Frontend: http://localhost:30000
- API: http://localhost:30001

### With Other Kubernetes Clusters
```bash
# Port forward services
kubectl port-forward -n ventiapi svc/frontend 3000:80
kubectl port-forward -n ventiapi svc/web-api 8000:8000

# Access via localhost
# Frontend: http://localhost:3000
# API: http://localhost:8000
```

## Monitoring and Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n ventiapi
kubectl get svc -n ventiapi
```

### View Logs
```bash
# Web API logs
kubectl logs -n ventiapi -l app=web-api -f

# Frontend logs
kubectl logs -n ventiapi -l app=frontend -f

# Scanner job logs
kubectl logs -n ventiapi job/scanner-job-<job-id>
```

### Check Scanner Jobs
```bash
# List all scanner jobs
kubectl get jobs -n ventiapi

# Watch job creation/completion
kubectl get jobs -n ventiapi -w

# Get job details
kubectl describe job scanner-job-<job-id> -n ventiapi
```

## Scaling

### Scale Web API
```bash
kubectl scale deployment web-api --replicas=2 -n ventiapi
```

### Scale Frontend
```bash
kubectl scale deployment frontend --replicas=2 -n ventiapi
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace ventiapi

# Or delete specific resources
kubectl delete -k ./kubernetes/
```

## Configuration

### Environment Variables

The web-api deployment can be configured with environment variables:

- `REDIS_URL`: Redis connection string (default: redis://redis:6379)
- `FRONTEND_URL`: Frontend URL for CORS
- `ADDITIONAL_CORS_ORIGINS`: Additional CORS origins (comma-separated)

### Resource Limits

Default resource requests and limits:

| Component | Memory Request | Memory Limit | CPU Request | CPU Limit |
|-----------|----------------|--------------|-------------|-----------|
| web-api | 256Mi | 512Mi | 250m | 500m |
| frontend | 64Mi | 128Mi | 50m | 100m |
| redis | 64Mi | 128Mi | 50m | 100m |

## Security Features

- **RBAC**: Service account with minimal permissions for job management
- **Network Policies**: (Optional) Can be added for network isolation
- **Resource Limits**: Prevents resource exhaustion
- **Health Checks**: Readiness and liveness probes for reliability

## Parallel Scanning

The scanner automatically creates 3 parallel Kubernetes Jobs for each scan:
- Each job gets 1/3 of the total request budget
- Jobs are monitored independently 
- UI shows progress for each container
- Jobs stop automatically when request budget is exhausted