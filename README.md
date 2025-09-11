# BadWebApp - API Security Scanner

A complete full-stack application for scanning APIs for security vulnerabilities using the VentiAPI Scanner.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Web API       │    │   Scanner       │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (VentiAPI)    │
│   Port: 3000    │    │   Port: 8000    │    │   (Containers)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache/Queue) │
                       │   Port: 6379    │
                       └─────────────────┘
```

## 🚀 Quick Start

1. **Clone and navigate to project:**
   ```bash
   git clone <your-repo-url>
   cd ScannerApp
   ```

2. **Initialize git submodules:**
   ```bash
   git submodule update --init --recursive
   ```

3. **Start the full stack:**
   ```bash
   docker compose up --build
   ```

4. **Access the application:**
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:8000
   - **API Documentation:** http://localhost:8000/docs

## 📁 Project Structure

```
ScannerApp/
├── docker-compose.yml          # Full-stack orchestration
├── frontend/                   # React TypeScript app
│   ├── src/
│   │   ├── api/               # API client (TanStack Query)
│   │   ├── components/        # React components
│   │   └── ...
│   ├── Dockerfile             # Multi-stage build
│   ├── nginx.conf             # Production web server
│   └── package.json
├── external-scanner/           # VentiAPI Scanner (Git Submodule)
│   └── ventiapi-scanner/      # External scanner code
│       ├── scanner/           # Core scanner logic
│       ├── templates/         # Report templates
│       └── examples/          # Example configurations
├── scanner-service/            # Your custom backend services
│   ├── web-api/               # FastAPI backend
│   │   ├── main.py            # API endpoints
│   │   ├── Dockerfile         # Web API container
│   │   └── requirements.txt
│   └── ...
```

## 🔧 Features

### Frontend (React + TypeScript)
- **Real-time scanning** with progress updates
- **File upload** for OpenAPI specifications
- **TanStack Query** for optimized API state management
- **Responsive UI** with multiple brand themes
- **Report downloads** in HTML format

### Backend (FastAPI)
- **Async scan orchestration** using Docker containers
- **RESTful API** with auto-generated documentation
- **File handling** for OpenAPI spec uploads
- **Real-time status** polling endpoints
- **Redis integration** for caching and job queues

### Scanner (VentiAPI)
- **OWASP API Top 10** vulnerability detection
- **Static and active** security probes
- **Configurable scan parameters** (RPS, dangerous mode, etc.)
- **Detailed reporting** with severity classification

## 🔍 API Endpoints

### Scan Management
- `POST /api/scan/start` - Start a new security scan
- `GET /api/scan/{scan_id}/status` - Get scan progress/status
- `GET /api/scan/{scan_id}/findings` - Get paginated results
- `GET /api/scan/{scan_id}/report` - Download HTML report
- `GET /api/scans` - List all scans
- `DELETE /api/scan/{scan_id}` - Delete scan and results

### Example Usage
```bash
# Start a scan
curl -X POST "http://localhost:8000/api/scan/start" \
  -F "server_url=http://your-api.com" \
  -F "spec_file=@openapi.yml"

# Check status
curl "http://localhost:8000/api/scan/{scan_id}/status"
```

## 🛠️ Development

### Run Individual Services
```bash
# Frontend only
cd frontend && npm start

# Backend only
cd scanner-service/web-api && uvicorn main:app --reload

# Scanner only (external)
cd external-scanner/ventiapi-scanner && python -m scanner.cli --help
```

### Git Submodule Management
```bash
# Update to latest external scanner version
git submodule update --remote external-scanner

# Pull updates from external scanner repository
cd external-scanner
git pull origin main
cd ..
git add external-scanner
git commit -m "Update external scanner to latest version"

# For collaborators: Initialize submodules after cloning
git submodule update --init --recursive
```

### Environment Variables
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:8000)

## 🎯 Target APIs

You can test the scanner against various vulnerable APIs:
- **VAmPI**: Vulnerable API Made with Python (included in external scanner)
- **Your own APIs**: Upload OpenAPI specifications to scan custom endpoints
- **Public demo APIs**: Test against publicly available API endpoints

## 🔒 Security Notes

- Scanner runs in isolated containers
- File uploads are validated and sandboxed
- Reports are generated server-side
- No sensitive data persisted long-term

## 📊 Supported Vulnerability Types

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `docker compose up --build`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.