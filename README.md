# VentiAPI Scanner - Microservice API Security Testing Platform

A modern full-stack application for scanning APIs for security vulnerabilities using microservice architecture and real-time progress tracking. **Now with Kubernetes orchestration support!**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     Production-Ready Deployment Options                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

Docker Compose (Development)     │    Kubernetes (Production/Local)
                                │
┌─────────────────┐              │    ┌─────────────────────────────────┐
│   nginx:3000    │              │    │      k3d/EKS Cluster           │
│   ├─ static     │              │    │  ┌─────────────────────────────┐ │
│   └─ /api proxy │              │    │  │       Frontend Pod          │ │
├─────────────────┤              │    │  │   nginx + React build       │ │
│   web-api:8000  │              │    │  └─────────────────────────────┘ │
│   ├─ FastAPI    │              │    │  ┌─────────────────────────────┐ │
│   └─ Scanner    │              │    │  │       Web-API Pod           │ │
├─────────────────┤              │    │  │   FastAPI + Auth            │ │
│   redis:6379    │              │    │  └─────────────────────────────┘ │
│   ├─ Cache      │              │    │  ┌─────────────────────────────┐ │
│   └─ Jobs       │              │    │  │       Redis Pod             │ │
├─────────────────┤              │    │  │   Rate Limit + Cache        │ │
│  scanner:latest │              │    │  └─────────────────────────────┘ │
│   ├─ VentiAPI   │              │    │  ┌─────────────────────────────┐ │
│   └─ On-demand  │              │    │  │    Scanner Jobs (Dynamic)   │ │
└─────────────────┘              │    │  │   Kubernetes Jobs           │ │
                                │    │  │   Auto-scaling              │ │
                                │    │  └─────────────────────────────┘ │
                                │    └─────────────────────────────────┘
```

### **Deployment Architecture Options**
- **Docker Compose**: Perfect for local development and simple deployments
- **Kubernetes**: Production-ready with auto-scaling, high availability, and job orchestration
- **Hybrid**: Use Docker Compose locally, Kubernetes for production

## Key Features

### **Microservice Architecture**
- **Parallel Processing**: Simulates parallel execution with 3 worker chunks for enhanced progress tracking
- **Independent Scanners**: Docker container execution with async subprocess management
- **Real-time Progress**: Live updates showing progress of each parallel worker with TanStack Query
- **Secure Authentication**: JWT-based auth with role-based access control

### **Comprehensive Security Testing** 
- **OWASP API Top 10** complete coverage (API1-API10)
- **19+ Vulnerability Types**: Authentication, Authorization, Data Exposure, Rate Limiting, etc.
- **Severity Classification**: High, Medium, Low with detailed evidence
- **Professional Reports**: Detailed findings with evidence and remediation guidance

### **Modern Stack**
- **React + TypeScript**: Modern frontend with type safety
- **FastAPI Backend**: High-performance async Python API with security middleware
- **Docker Microservices**: Containerized scanner components
- **Redis Integration**: Rate limiting and caching

## Quick Start

Choose your deployment method:

### 🚀 Option 1: Kubernetes (Recommended for Production)

**Prerequisites:**
- Docker installed and running
- kubectl installed
- k3d installed (for local) or access to AWS EKS (for production)

**One-Command Deployment:**
```bash
# First-time setup (creates cluster and deploys)
./kubernetes_deploy.sh

# Quick start/stop (manages existing deployment)
./start-kubernetes.sh        # Start the app
./start-kubernetes.sh stop   # Stop the app
./start-kubernetes.sh status # Check status
```

**Manual Deployment:**
```bash
# 1. Setup and deploy
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive

# 2. Deploy to Kubernetes
./kubernetes_deploy.sh

# 3. Access your application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Credentials: MICS295 / MaryMcHale
```

**Features:**
- ✅ **Auto-scaling** based on CPU/memory usage
- ✅ **High availability** with multiple replicas  
- ✅ **Job orchestration** for dynamic scanner containers
- ✅ **Health checks** and automatic restarts
- ✅ **Local/production parity** with k3d and EKS

### 🐳 Option 2: Docker Compose (Simple Development)

**Prerequisites:**
- Docker & Docker Compose
- Git with submodule support

**Setup:**
```bash
# 1. Clone and setup
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# 3. Start development environment
./start-dev.sh
```

**Features:**
- ✅ **Simple setup** for local development
- ✅ **Hot reload** for rapid development
- ✅ **All services** in one command
- ✅ **Volume mounting** for development

### 4. Access the Application
- **Application:** http://localhost:3000 (nginx serves frontend + proxies API)
- **API Endpoints:** http://localhost:3000/api/* (proxied to backend)
- **API Documentation:** http://localhost:3000/api/docs (via nginx proxy)
- **Health Check:** http://localhost:3000/health
- **Redis:** localhost:6379 (internal)

### 5. Login and Start Scanning
1. Open http://localhost:3000 in your browser
2. Login with the credentials you set in `.env.local`
3. Upload an OpenAPI spec file or enter a server URL
4. Start scanning and monitor real-time progress

## Environment Variables

The application uses environment variables for configuration. Copy `.env.local.example` to `.env.local` and update:

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing | `H6KaXFDmL0C+qWzrzl5y4sDH2wbVSwrifZ16dHZZKAA=` |
| `DEFAULT_ADMIN_USERNAME` | Admin username for login | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | Admin password for login | `your-secure-password` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SCANNER_MAX_PARALLEL_CONTAINERS` | Max parallel scanner containers | `5` |
| `SCANNER_CONTAINER_MEMORY_LIMIT` | Memory limit per scanner | `512m` |

⚠️ **Security Note**: Never commit `.env.local` to version control. It's already in `.gitignore`.

## Project Structure

```
ScannerApp/
├── docker-compose.yml              # Microservice orchestration
├── start-dev.sh                    # Development setup script
├── test.sh                         # API testing script
├── frontend/                       # React TypeScript app
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── ApiScanner.tsx     # Main scanning interface
│   │   │   └── Report.tsx         # Results display
│   │   └── ...
│   ├── Dockerfile                 # Multi-stage production build
│   ├── nginx.conf                 # Production web server config
│   └── package.json
├── external-scanner/               # VentiAPI Scanner (Git Submodule)
│   └── ventiapi-scanner/          # External scanner engine
│       ├── scanner/               # Core security probes
│       │   ├── probes/           # API1-API10 security tests
│       │   ├── core/             # Scanner framework
│       │   └── report/           # HTML report generation
│       └── templates/            # Report templates
├── scanner-service/                # Backend API service
│   └── web-api/                   # FastAPI backend
│       ├── main.py               # API endpoints + microservice orchestration
│       ├── security.py           # JWT auth + security middleware
│       ├── scanner_plugins/      # Scanner plugin system
│       │   └── microservice_scanner.py  # Docker container orchestration
│       ├── Dockerfile            # Web API container
│       └── requirements.txt
├── shared/                         # Shared volumes
│   ├── results/                  # Scan results storage
│   └── specs/                    # OpenAPI spec storage
└── .env.local                     # Development environment variables
```

## Advanced Features

### Real-Time Progress Tracking
- **TanStack Query Integration**: Automatic polling every 2 seconds during scans
- **Parallel Container Monitoring**: Individual progress for each scan chunk
- **Phase Tracking**: "Running auth probes", "Running scan probes", etc.
- **Smart Polling**: Automatically stops when scan completes

### Intelligent Scan Optimization
- **Endpoint Chunking**: Splits large APIs into 4-endpoint chunks for parallel processing
- **Probe Grouping**: 
  - **Auth Group**: Authentication-related probes (may interact)
  - **Scan Group**: Read-only probes (safe parallel execution)
  - **Dangerous Group**: Intrusive probes (optional, run separately)
- **Result Merging**: Aggregates findings from all parallel containers

### Professional Reporting
- **Dual Format**: JSON findings + HTML reports
- **Embedded Styling**: Self-contained HTML with CSS
- **Severity Breakdown**: Visual summary with color-coded severity levels
- **Downloadable Reports**: Direct browser download via API

## API Endpoints

### Core Scan Management
```bash
# Start a new scan
POST /api/scan/start
  - Form data: spec_file, server_url, target_url, dangerous, rps, max_requests

# Real-time status with parallel info
GET /api/scan/{scan_id}/status
  Response includes: progress, current_phase, chunk_status[], parallel_mode

# Get paginated findings
GET /api/scan/{scan_id}/findings?offset=0&limit=50

# Download HTML report
GET /api/scan/{scan_id}/report

# List all scans
GET /api/scans

# Delete scan and cleanup
DELETE /api/scan/{scan_id}
```

### Example Usage
```bash
# Login and get token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "MICS295", "password": "MaryMcHale"}' | \
  jq -r '.access_token')

# Start a microservice scan
curl -X POST "http://localhost:8000/api/scan/start" \
  -H "Authorization: Bearer $TOKEN" \
  -F "server_url=https://your-api.com" \
  -F "spec_file=@openapi.json"

# Monitor real-time progress
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/scan/{scan_id}/status"

# Get detailed findings
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/scan/{scan_id}/findings"
```

## 🚀 Deployment Options

### Local Development

#### Kubernetes (k3d)
```bash
# Quick start
./kubernetes_deploy.sh

# Manual commands
k3d cluster create ventiapi-local --port "3000:30000@agent:0" --port "8000:30001@agent:0" --agents 2
kubectl apply -f kubernetes/base/
```

#### Docker Compose
```bash
# Quick start
./start-dev.sh

# Manual commands  
docker compose up --build
```

### Production Deployment

#### AWS EKS (Kubernetes)
```bash
# Create EKS cluster
eksctl create cluster --name ventiapi-prod --region us-west-2 --nodegroup-name workers --node-type t3.medium --nodes 2

# Deploy application
kubectl apply -k kubernetes/overlays/production/
```

#### AWS Lightsail (Docker Compose)
```bash
# Simple VPS deployment with full Docker support
# See LIGHTSAIL_DEPLOYMENT.md for complete guide
aws lightsail create-instances --instance-names ventiapi-scanner --blueprint-id ubuntu_20_04 --bundle-id medium_2_0
```

#### Railway/Render (Simplified)
- **Note**: These platforms don't support Docker-in-Docker, so scanner functionality would need to be embedded
- See platform-specific deployment guides

### Management Commands

#### Kubernetes
```bash
# Quick management
./start-kubernetes.sh start    # Start application
./start-kubernetes.sh stop     # Stop application  
./start-kubernetes.sh status   # Show status
./start-kubernetes.sh logs web-api  # Show logs
./start-kubernetes.sh delete   # Delete cluster

# Advanced kubectl commands
kubectl get all -n ventiapi                           # View all resources
kubectl scale deployment web-api --replicas=5 -n ventiapi  # Scale services
kubectl logs deployment/web-api -n ventiapi -f        # View logs
k3d cluster delete ventiapi-local                     # Delete cluster
```

#### Docker Compose
```bash
# View status
docker compose ps

# Scale services
docker compose up --scale web-api=3

# View logs
docker compose logs -f web-api

# Clean up
docker compose down
```


## Development & Testing

### Local Development
```bash
# Frontend only
cd frontend && npm start

# Backend only (with hot reload)
cd scanner-service/web-api && uvicorn main:app --reload --host 0.0.0.0

# Scanner only
cd external-scanner/ventiapi-scanner && python -m scanner.cli --help
```

### Git Submodule Management
```bash
# Update to latest external scanner
git submodule update --remote external-scanner

# Commit submodule updates
git add external-scanner && git commit -m "Update scanner to latest version"

# For new clones
git submodule update --init --recursive
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:8000` |
| `PYTHONUNBUFFERED` | Python output buffering | `1` |

## Performance & Scaling

### Current Capabilities
- **Parallel Processing**: 3x faster scanning with automatic endpoint chunking
- **Container Scaling**: Dynamic scanner container creation
- **Real-time Updates**: 2-second polling with smart query management
- **Memory Efficient**: Streaming results, minimal persistent storage

### Scaling Considerations
- **Horizontal Scaling**: Add more Docker containers or K8s pods
- **Redis Clustering**: For high-concurrency scenarios  
- **Database Integration**: Replace in-memory storage with PostgreSQL/MySQL
- **CDN Integration**: For static assets

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test locally: `docker compose up --build`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Development Workflow
- Follow TypeScript best practices
- Use TanStack Query for all API state management
- Test with real vulnerable APIs (VAmPI included)
- Update documentation for new features

## License

MIT License - see LICENSE file for details.

## Supported Vulnerability Types

### OWASP API Security Top 10
- **API1**: Broken Object Level Authorization (BOLA)
- **API2**: Broken User Authentication  
- **API3**: Excessive Data Exposure
- **API4**: Lack of Resources & Rate Limiting
- **API5**: Broken Function Level Authorization (BFLA)
- **API6**: Mass Assignment
- **API7**: Security Misconfiguration
- **API8**: Injection Flaws
- **API9**: Improper Assets Management
- **API10**: Insufficient Logging & Monitoring

### Advanced Features
- **Rate Limiting Detection**: Configurable RPS testing
- **Authentication Fuzzing**: Token manipulation and bypass attempts
- **Dangerous Mode**: Intrusive testing with data modification
- **Custom Payloads**: Extensible probe system

---

**Built with for API Security**