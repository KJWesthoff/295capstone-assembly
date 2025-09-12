# VentiAPI Scanner - Full-Stack API Security Testing Platform

A complete full-stack application for scanning APIs for security vulnerabilities using parallel processing and real-time progress tracking.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Web API       │    │   Scanner Cluster   │
│   (React +      │◄──►│   (FastAPI +    │◄──►│   (VentiAPI)        │
│   TanStack      │    │   Parallel      │    │   Parallel          │
│   Query)        │    │   Processing)   │    │   Containers        │
│   Port: 3000    │    │   Port: 8000    │    │   Dynamic Scaling   │
└─────────────────┘    └─────────────────┘    └─────────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache/Queue) │
                       │   Port: 6379    │
                       └─────────────────┘
```

## ✨ Key Features

### 🚀 **Performance Optimized**
- **Parallel Scanning**: Automatically splits large API specs into chunks and runs multiple containers concurrently
- **Smart Probe Grouping**: Groups compatible security probes to avoid conflicts while maximizing parallelism
- **Real-time Progress**: Live updates with TanStack Query showing individual container progress

### 🔍 **Comprehensive Security Testing** 
- **OWASP API Top 10** complete coverage (API1-API10)
- **Static & Active Probes**: Both specification analysis and runtime testing
- **Severity Classification**: Critical, High, Medium, Low with detailed scoring
- **Professional Reports**: HTML reports with embedded CSS and findings breakdown

### 💻 **Modern Full-Stack**
- **React 19 + TypeScript**: Modern frontend with type safety
- **FastAPI Backend**: High-performance async Python API
- **Docker Orchestration**: Complete containerized deployment
- **Redis Caching**: Optimized performance and job queuing

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git with submodule support

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive
```

### 2. Start the Full Stack
```bash
docker compose up --build
```

### 3. Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Redis:** localhost:6379

## 📁 Project Structure

```
ScannerApp/
├── docker-compose.yml              # Full-stack orchestration
├── frontend/                       # React TypeScript app
│   ├── src/
│   │   ├── api/                   # TanStack Query API client
│   │   ├── components/            # React components
│   │   │   ├── ApiScanner.tsx     # Main scanning interface
│   │   │   ├── Report.tsx         # Results display with real-time updates
│   │   │   └── ParallelScanProgress.tsx  # Parallel progress visualization
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
├── scanner-service/                # Custom backend services
│   └── web-api/                   # FastAPI backend
│       ├── main.py               # API endpoints + parallel orchestration
│       ├── Dockerfile            # Web API container
│       └── requirements.txt
└── README.md                      # This file
```

## 🔧 Advanced Features

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

## 🔍 API Endpoints

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
# Start a parallel scan
curl -X POST "http://localhost:8000/api/scan/start" \
  -F "server_url=https://your-api.com" \
  -F "target_url=https://your-api.com" \
  -F "spec_file=@openapi.yml" \
  -F "dangerous=false" \
  -F "rps=2.0"

# Monitor real-time progress
curl "http://localhost:8000/api/scan/{scan_id}/status"

# Download professional HTML report
curl "http://localhost:8000/api/scan/{scan_id}/report" -o security_report.html
```


## 🛠️ Development & Testing

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

## 📊 Performance & Scaling

### Current Capabilities
- **Parallel Processing**: 3x faster scanning with automatic endpoint chunking
- **Container Scaling**: Dynamic scanner container creation
- **Real-time Updates**: 2-second polling with smart query management
- **Memory Efficient**: Streaming results, minimal persistent storage

### Scaling Considerations
- **Horizontal Scaling**: Add more ECS tasks or K8s pods
- **Redis Clustering**: For high-concurrency scenarios  
- **Database Integration**: Replace in-memory storage with RDS/DynamoDB
- **CDN Integration**: CloudFront for static assets

## 🤝 Contributing

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

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Supported Vulnerability Types

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

**Built with ❤️ for API Security**