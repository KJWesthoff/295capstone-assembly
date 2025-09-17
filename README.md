# VentiAPI Scanner - Full-Stack API Security Testing Platform

A complete full-stack application for scanning APIs for security vulnerabilities using parallel processing, Nginx reverse proxy, real-time progress tracking, and cloud deployment support.

🌐 **Live Demo**: [https://ventiapiscanner-production.up.railway.app](https://ventiapiscanner-production.up.railway.app)

## 🏗️ Architecture

### Production Architecture (Nginx Reverse Proxy)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   Nginx Proxy   │    │   Frontend      │    │   Web API       │    │   Scanner Cluster   │
│   (Port 80)     │◄──►│   (React +      │    │   (FastAPI +    │◄──►│   (VentiAPI)        │
│   /     → FE    │    │   TanStack      │    │   Parallel      │    │   Parallel          │
│   /api  → BE    │    │   Query)        │    │   Processing)   │    │   Containers        │
│   Rate Limiting │    │   Internal      │    │   Internal      │    │   Dynamic Scaling   │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────────┐
                                               │     Redis       │
                                               │   (Cache/Queue) │
                                               │   Internal      │
                                               └─────────────────┘
```

### Development Architecture (Hybrid Access)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   Nginx Proxy   │    │   Frontend      │    │   Web API       │    │   Scanner Cluster   │
│   (Port 80)     │◄──►│   (React +      │    │   (FastAPI +    │◄──►│   (VentiAPI)        │
│   API Routing   │    │   TanStack      │    │   Parallel      │    │   Parallel          │
└─────────────────┘    │   Query)        │    │   Processing)   │    │   Containers        │
                       │   Port: 3000    │    │   Internal      │    │   Dynamic Scaling   │
                       └─────────────────┘    └─────────────────┘    └─────────────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────────┐
                                               │     Redis       │
                                               │   (Cache/Queue) │
                                               │   Internal      │
                                               └─────────────────┘
```

### Railway Cloud Architecture (Serverless)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Railway Container                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │   Nginx Proxy   │    │   Frontend      │    │   Web API + Scanner        │  │
│  │   (Port 8000)   │◄──►│   (Static Files)│    │   (FastAPI + VentiAPI)     │  │
│  │   /     → FE    │    │   Built React   │    │   Direct Subprocess        │  │
│  │   /api  → BE    │    │   Served by     │    │   Railway Compatible       │  │
│  │   Rate Limiting │    │   FastAPI       │    │   No Docker Required       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────────┘  │
│                                                            │                     │
│                                                            ▼                     │
│                                                 ┌─────────────────┐             │
│                                                 │     Redis       │             │
│                                                 │   (Cache/Queue) │             │
│                                                 │   Local Process │             │
│                                                 └─────────────────┘             │
│                                                                                 │
│  🌐 HTTPS: ventiapiscanner-production.up.railway.app                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Key Features

### **Production-Ready Infrastructure**
- **Nginx Reverse Proxy**: Single entry point with SSL support, rate limiting, and security headers
- **Container Orchestration**: Complete Docker Compose setup with health checks and restart policies
- **Cloud Deployment**: One-command Railway deployment with automatic HTTPS and scaling
- **Internal Networking**: Secure container-to-container communication
- **Volume Management**: Persistent shared storage for results and specifications

### **Performance Optimized**
- **Parallel Scanning**: Automatically splits large API specs into chunks and runs multiple containers concurrently
- **Railway-Compatible**: Direct subprocess execution for cloud environments without Docker-in-Docker
- **Configurable Scaling**: Adjust parallel container count and chunk size via environment variables
- **Smart Probe Grouping**: Groups compatible security probes to avoid conflicts while maximizing parallelism
- **Real-time Progress**: Live updates with TanStack Query showing individual container progress

### **Comprehensive Security Testing** 
- **OWASP API Top 10** complete coverage (API1-API10)
- **Static & Active Probes**: Both specification analysis and runtime testing
- **Severity Classification**: Critical, High, Medium, Low with detailed scoring
- **Professional Reports**: HTML reports with embedded CSS and findings breakdown

### **Modern Full-Stack**
- **React 19 + TypeScript**: Modern frontend with type safety
- **FastAPI Backend**: High-performance async Python API
- **Docker Orchestration**: Complete containerized deployment with reverse proxy
- **Redis Caching**: Optimized performance and job queuing

## 🎯 Quick Start

### Prerequisites
- **Local Development**: Docker & Docker Compose, Git with submodule support, 4GB+ RAM
- **Cloud Deployment**: Railway account (free tier available)

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive
```

### 2. Choose Your Deployment Mode

## 🌐 Cloud Deployment (Railway)

### ⚡ One-Command Deploy
```bash
# Deploy to Railway with one command
./start-railway.sh
```

**What this does:**
- Installs Railway CLI (if needed)
- Handles Railway login
- Initializes Railway project
- Sets secure environment variables automatically
- Deploys with optimized multi-stage build
- Provides your live HTTPS URL

**Result**: Your app will be live at `https://your-app.railway.app` with:
- ✅ Automatic HTTPS
- ✅ Professional domain
- ✅ Nginx reverse proxy
- ✅ Parallel scanning (Railway-compatible)
- ✅ Real-time progress tracking
- ✅ Admin authentication

### 🔧 Railway Management
```bash
# View your app URL
railway domain

# Check environment variables
railway variables

# View logs
railway logs

# Update deployment
railway up
```

### 💰 Railway Pricing
- **Free Tier**: Perfect for testing and demos
- **Pro Tier** ($5/month): Custom domains, increased resources
- **Automatic scaling** based on usage

## 🏠 Local Development

#### Production Mode (Recommended) - Nginx Reverse Proxy
```bash
# Start with Nginx reverse proxy (single entry point)
./start-production.sh
```
- **Access:** http://localhost (everything routed through Nginx)
- **API:** http://localhost/api/*
- **API Documentation:** http://localhost/api/docs
- **Features:** Rate limiting, security headers, SSL-ready

#### Development Mode - Hybrid Access  
```bash
# Start with hybrid access for debugging
./start-dev.sh
```
- **Frontend (Direct):** http://localhost:3000 (fast development)
- **Frontend (via Nginx):** http://localhost (production-like)
- **API (via Nginx):** http://localhost/api/*
- **API Documentation:** http://localhost/api/docs

## ⚙️ Configuration

### Environment Variables

#### Local Development (`.env.local`)
```bash
# Authentication
JWT_SECRET=your-secure-jwt-secret-here
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your-secure-password

# Scanner Performance
SCANNER_MAX_PARALLEL_CONTAINERS=10    # Max concurrent scanner containers
SCANNER_CONTAINER_MEMORY_LIMIT=1g     # Memory limit per container

# Redis Configuration
REDIS_URL=redis://redis:6379
```

#### Railway Cloud (Managed via CLI)
```bash
# Set Railway environment variables
railway variables --set "DEFAULT_ADMIN_PASSWORD=your-secure-password"
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=5"
railway variables --set "SCANNER_CONTAINER_MEMORY_LIMIT=512m"

# View current variables
railway variables

# Auto-generated by deployment script:
# JWT_SECRET, DEFAULT_ADMIN_USERNAME, REDIS_URL
```

### Parallel Scanning Configuration

Control the number of scanner containers launched:

#### Via Environment Variables (Recommended)
```bash
# In .env.local
SCANNER_MAX_PARALLEL_CONTAINERS=15    # Increase from default 5
SCANNER_CONTAINER_MEMORY_LIMIT=2g     # Increase if needed
```

#### Performance Examples
| API Size | Chunk Size | Max Containers | Actual Containers | Speed Gain |
|----------|------------|----------------|-------------------|------------|
| 8 endpoints | 2 | 10 | 4 containers | ~3x faster |
| 16 endpoints | 2 | 10 | 8 containers | ~6x faster |
| 32 endpoints | 2 | 15 | 15 containers | ~10x faster |

#### Resource Recommendations
- **Development**: `SCANNER_MAX_PARALLEL_CONTAINERS=3`, `MEMORY_LIMIT=512m`
- **Production**: `SCANNER_MAX_PARALLEL_CONTAINERS=10`, `MEMORY_LIMIT=1g`
- **High-Performance**: `SCANNER_MAX_PARALLEL_CONTAINERS=20`, `MEMORY_LIMIT=2g`

## 📁 Project Structure

```
ScannerApp/
├── docker-compose.yml              # Production orchestration with nginx
├── docker-compose.dev.yml          # Development overrides
├── docker-compose.railway.yml      # Railway single-service deployment
├── nginx/
│   ├── nginx.conf                  # Production reverse proxy config
│   ├── nginx.railway.conf          # Railway-optimized config
│   └── nginx-ssl.conf              # SSL-ready configuration template
├── start-production.sh             # Production startup script
├── start-dev.sh                    # Development startup script
├── start-railway.sh                # One-command Railway deployment
├── Dockerfile.railway.simple       # Railway-optimized container build
├── railway.json                    # Railway platform configuration
├── RAILWAY_DEPLOY.md              # Complete Railway deployment guide
├── frontend/                       # React TypeScript app
│   ├── src/
│   │   ├── api/                   # TanStack Query API client
│   │   ├── components/            # React components
│   │   │   ├── ApiScanner.tsx     # Main scanning interface
│   │   │   ├── Report.tsx         # Results display with real-time updates
│   │   │   └── ParallelScanProgress.tsx  # Parallel progress visualization
│   │   └── ...
│   ├── Dockerfile                 # Multi-stage production build
│   └── package.json
├── external-scanner/               # VentiAPI Scanner (Git Submodule)
│   └── ventiapi-scanner/          # External scanner engine
│       ├── scanner/               # Core security probes
│       │   ├── probes/           # API1-API10 security tests
│       │   ├── core/             # Scanner framework
│       │   └── report/           # HTML report generation
│       └── templates/            # Report templates
├── scanner-service/                # Custom backend services
│   └── web-api/                   # FastAPI backend
│       ├── main.py               # API endpoints + parallel orchestration + security
│       ├── security.py           # Authentication, authorization & validation
│       ├── Dockerfile            # Web API container
│       └── requirements.txt
├── shared/                        # Shared volumes
│   ├── results/                  # Scan results storage
│   └── specs/                    # API specifications storage
└── README.md                      # This file
```

## 🔧 Advanced Features

### Nginx Reverse Proxy Features
- **Rate Limiting**: 10 req/s for API, 100 req/s general
- **Security Headers**: XSS protection, frame options, content type validation
- **File Upload Limits**: 10MB max for API specification uploads
- **SSL-Ready**: Easy HTTPS configuration with provided template
- **Gzip Compression**: Automatic compression for better performance

### Real-Time Progress Tracking
- **TanStack Query Integration**: Automatic polling every 2 seconds during scans
- **Parallel Container Monitoring**: Individual progress for each scan chunk
- **Phase Tracking**: "Running auth probes", "Running scan probes", etc.
- **Smart Polling**: Automatically stops when scan completes

### Intelligent Scan Optimization
- **Endpoint Chunking**: Splits large APIs into 2-endpoint chunks for maximum parallelism
- **Cloud-Compatible Execution**: Automatically detects environment and chooses execution method:
  - **Local Development**: Docker containers for isolation
  - **Railway/Cloud**: Direct subprocess execution (no Docker-in-Docker required)
- **Probe Grouping**: 
  - **Auth Group**: Authentication-related probes (may interact)
  - **Scan Group**: Read-only probes (safe parallel execution)
  - **Dangerous Group**: Intrusive probes (optional, run separately)
- **Result Merging**: Aggregates findings from all parallel containers
- **Graceful Degradation**: Continues if some containers fail

### Professional Reporting
- **Dual Format**: JSON findings + HTML reports
- **Embedded Styling**: Self-contained HTML with CSS
- **Severity Breakdown**: Visual summary with color-coded severity levels
- **Downloadable Reports**: Direct browser download via API
- **Real-time Updates**: Live progress tracking during scans

## 🌐 API Endpoints

### Core Scan Management
```bash
# Start a new scan with parallel processing
POST /api/scan/start
  - Form data: spec_file, server_url, target_url, dangerous, rps, max_requests

# Real-time status with parallel container info
GET /api/scan/{scan_id}/status
  Response includes: progress, current_phase, chunk_status[], parallel_mode

# Get paginated findings
GET /api/scan/{scan_id}/findings?offset=0&limit=50

# Download HTML report
GET /api/scan/{scan_id}/report

# List all scans with status
GET /api/scans

# Delete scan and cleanup
DELETE /api/scan/{scan_id}

# Health check
GET /health
```

### Example Usage
```bash
# Start a parallel scan via nginx proxy
curl -X POST "http://localhost/api/scan/start" \
  -F "server_url=https://your-api.com" \
  -F "target_url=https://your-api.com" \
  -F "spec_file=@openapi.yml" \
  -F "dangerous=false" \
  -F "rps=2.0"

# Monitor real-time parallel progress
curl "http://localhost/api/scan/{scan_id}/status" | jq '.chunk_status'

# Download professional HTML report
curl "http://localhost/api/scan/{scan_id}/report" -o security_report.html
```

## 🔐 SSL/HTTPS Setup

### Enable HTTPS (Production)
1. **Obtain SSL certificates** (Let's Encrypt recommended):
```bash
certbot certonly --webroot -w /var/www/html -d yourdomain.com
```

2. **Copy certificates to nginx directory**:
```bash
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
```

3. **Switch to SSL configuration**:
```bash
cp nginx/nginx-ssl.conf nginx/nginx.conf
```

4. **Update docker-compose.yml** to mount SSL certificates:
```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro  # Add this line
```

## 🛠️ Development & Testing

### Local Development Commands
```bash
# Start development environment
./start-dev.sh

# View logs from all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Restart specific service
docker compose restart web-api

# View container resource usage
docker stats

# Scale containers manually for testing
SCANNER_MAX_PARALLEL_CONTAINERS=20 ./start-dev.sh
```

### Testing Different Configurations
```bash
# Test with 2 endpoints per chunk (more containers)
# Edit main.py: chunk_size=2

# Test with high parallel count
export SCANNER_MAX_PARALLEL_CONTAINERS=15
./start-dev.sh

# Monitor container creation during scans
watch 'docker ps | grep ventiapi'
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

## 📊 Performance & Monitoring

### Current Capabilities
- **Parallel Processing**: Up to 10x faster scanning with automatic endpoint chunking
- **Container Scaling**: Dynamic scanner container creation based on API size
- **Real-time Updates**: 2-second polling with smart query management
- **Memory Efficient**: Streaming results, configurable memory limits per container
- **Resource Monitoring**: Built-in container health checks and restart policies

### Monitoring Commands
```bash
# View container resource usage
docker stats

# Check nginx access logs
docker compose logs nginx

# Monitor scan progress in real-time
curl -s http://localhost/api/scan/{scan_id}/status | jq '.chunk_status'

# View parallel container creation
docker ps --filter "name=ventiapi-scanner"
```

### Performance Tuning
```bash
# For high-throughput environments
SCANNER_MAX_PARALLEL_CONTAINERS=20
SCANNER_CONTAINER_MEMORY_LIMIT=2g
REDIS_MAXMEMORY=1gb

# For resource-constrained environments  
SCANNER_MAX_PARALLEL_CONTAINERS=3
SCANNER_CONTAINER_MEMORY_LIMIT=512m
REDIS_MAXMEMORY=256mb
```

## 🐛 Troubleshooting

### Railway Deployment Issues

#### Scanner Returns 0 Findings
✅ **Fixed in latest version**: The app now automatically detects Railway environment and uses direct subprocess execution instead of Docker containers.

If you still see this issue:
```bash
# Check logs for Railway-compatible execution
railway logs

# Should see: "Starting Railway-compatible scanner" instead of "docker run"
```

#### Authentication Issues
```bash
# Check environment variables are set
railway variables

# Restart service after changing variables
railway up

# Reset admin password
railway variables --set "DEFAULT_ADMIN_PASSWORD=newpassword123"
railway up
```

#### Performance Issues
```bash
# Reduce parallel containers for Railway free tier
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=2"

# Check resource usage
railway logs

# Scale up on Railway Pro plan
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=8"
```

### Local Development Issues

#### Docker Container Failures
```bash
# Check Docker is running
docker ps

# Restart services
docker compose down && docker compose up

# Check container logs
docker compose logs scanner-service
```

#### Port Conflicts
```bash
# Check what's using port 80
sudo lsof -i :80

# Use development mode with port 3000
./start-dev.sh
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test with both deployment modes
4. Test parallel scaling: `SCANNER_MAX_PARALLEL_CONTAINERS=10 ./start-dev.sh`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Development Workflow
- Follow TypeScript best practices
- Use TanStack Query for all API state management
- Test with real vulnerable APIs (VAmPI included)
- Test both production and development deployment modes
- Update documentation for new features

## 📋 Supported Vulnerability Types

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
- **Parallel Execution**: Multiple probe types running concurrently

## 📄 License

MIT License - see LICENSE file for details.

---

**🚀 Built for Production-Scale API Security Testing**

✨ **Local Development**: Nginx Reverse Proxy + Parallel Container Orchestration  
☁️ **Cloud Deployment**: Railway-Compatible with One-Command Deploy  
🔍 **Security Testing**: Complete OWASP API Top 10 Coverage  
⚡ **Performance**: Intelligent Parallel Processing + Real-time Progress

**Deploy to Railway**: `./start-railway.sh`  
**Live Demo**: [ventiapiscanner-production.up.railway.app](https://ventiapiscanner-production.up.railway.app)