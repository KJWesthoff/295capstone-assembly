# VentiAPI Scanner - Containerized API Security Platform

A modern, containerized API security scanning platform with support for multiple scanner engines, real-time progress tracking, and cloud deployment.

🌐 **Live Demo**: [https://ventiapiscanner-production.up.railway.app](https://ventiapiscanner-production.up.railway.app)

## 🚀 Quick Start

### Local Development
```bash
# Clone and start the platform
git clone <repository>
cd ScannerApp

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
```

### Railway Cloud Deployment
```bash
# One-command deploy
railway link && railway up
```

## 🏗️ Architecture

### Containerized Scanner System
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │   FastAPI       │    │ Scanner Manager │
│   (Port 3000)   │◄──►│   (Port 8000)   │◄──►│   (Containers)  │
│                 │    │                 │    │                 │
│ • Scanner UI    │    │ • Plugin API    │    │ • VentiAPI      │
│ • Progress      │    │ • Auth/Security │    │ • OWASP ZAP     │
│ • Results       │    │ • Rate Limiting │    │ • Nuclei        │
└─────────────────┘    └─────────────────┘    │ • Custom        │
                                              └─────────────────┘
```

### Key Features
- **Multi-Scanner Support**: VentiAPI, OWASP ZAP, Nuclei, and custom scanners
- **Containerized Architecture**: Each scanner runs in isolated Docker containers
- **Real-time Progress**: Live scan status and progress tracking
- **Security-First**: JWT authentication, rate limiting, admin controls
- **Cloud Ready**: Deploys to Railway, Docker, or any container platform

## 🔧 Scanner Types

| Scanner | Description | Best For |
|---------|-------------|----------|
| **VentiAPI** | Fast API vulnerability scanner | OpenAPI specs, quick scans |
| **OWASP ZAP** | Comprehensive web security scanner | Deep security analysis |
| **Nuclei** | Template-based vulnerability scanner | Known CVEs, speed |
| **Custom** | Add your own scanners | Specialized testing |

## 🛡️ Security Features

- **JWT Authentication** with secure token management
- **Rate Limiting** to prevent abuse
- **Admin Controls** for dangerous scan modes
- **Input Validation** and file upload security
- **HTTPS Enforcement** in production
- **Security Logging** for audit trails

## 📊 API Endpoints

### Core Scanning
- `POST /api/scan/start` - Start a new scan
- `GET /api/scan/{id}/status` - Get scan progress
- `GET /api/scan/{id}/findings` - Retrieve results
- `DELETE /api/scan/{id}` - Stop/cancel scan

### Scanner Management
- `GET /api/scanners` - List available scanners
- `GET /api/statistics` - System statistics (admin)

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh

## 🐳 Adding New Scanners

1. **Create Scanner Manifest** (`scanner-manifests/my-scanner.yaml`)
```yaml
name: "My Custom Scanner"
type: "my-scanner"
image: "my-scanner:latest"
description: "Custom security scanner"
capabilities:
  targets: ["api", "web"]
  formats: ["openapi", "url"]
  parallel: true
  auth: true
```

2. **Build Scanner Container**
```bash
# Container must implement standard interface
# Input: /tmp/config.json
# Output: /tmp/findings.json
```

3. **Deploy and Test**
```bash
docker build -t my-scanner:latest .
# Scanner is automatically discovered and available
```

## 🚀 Deployment Options

### Local Development
```bash
docker-compose up -d
```

### Production (Railway)
```bash
railway login
railway link
railway up
```

### Manual Docker
```bash
# Frontend
docker build -t scanner-frontend frontend/
docker run -p 3000:80 scanner-frontend

# Backend
docker build -t scanner-api scanner-service/web-api/
docker run -p 8000:8000 scanner-api
```

## 📝 Configuration

### Environment Variables
```bash
# Required
JWT_SECRET=your-secret-key
ADMIN_PASSWORD=secure-admin-password

# Optional
RATE_LIMIT_ENABLED=true
MAX_CONCURRENT_SCANS=3
LOG_LEVEL=info
```

### Scanner Configuration
- Place scanner manifests in `/scanner-manifests/`
- Containers automatically discovered on startup
- Health checks ensure scanner availability

## 🔍 Usage Examples

### Basic API Scan
```javascript
// Start scan
const response = await fetch('/api/scan/start', {
  method: 'POST',
  body: formData // URL + optional spec file
});

// Monitor progress
const status = await fetch(`/api/scan/${scanId}/status`);

// Get results
const findings = await fetch(`/api/scan/${scanId}/findings`);
```

### Advanced Configuration
```javascript
const scanRequest = {
  target_url: "https://api.example.com",
  scanner_type: "venti-api",
  max_requests: 500,
  requests_per_second: 2.0,
  dangerous_mode: false,
  fuzz_auth: true
};
```

## 📊 Monitoring & Logs

- **Health Checks**: `/health` endpoint for monitoring
- **Scanner Statistics**: Real-time scanner health and performance
- **Security Events**: Authentication and scan activity logging
- **Performance Metrics**: Scan duration and success rates

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-scanner`
3. Add your scanner using the containerized architecture
4. Test thoroughly with provided test APIs
5. Submit pull request with documentation

## 📚 Documentation

- **Security Guide**: See `SECURITY.md` for security implementation details
- **API Reference**: Interactive docs at `/docs` endpoint
- **Scanner Development**: Container interface specification included

## 🔧 Troubleshooting

### Common Issues
- **Scanner Offline**: Check Docker container status and manifest
- **Authentication Errors**: Verify JWT token and user permissions
- **Rate Limiting**: Reduce scan frequency or contact admin
- **File Upload Fails**: Check file size and format requirements

### Support
- Review container logs: `docker logs <container-name>`
- Check scanner health: `GET /api/scanners`
- Monitor system status: `GET /api/statistics`

---

**License**: MIT | **Maintainer**: Security Engineering Team