# VentiAPI Scanner - API Security Testing Platform

A modern full-stack application for scanning APIs for security vulnerabilities with real-time progress tracking.

## 🚀 Quick Start

**Live Demo**: [http://54.241.100.240:3000](http://54.241.100.240:3000)
- **Username**: `MICS295`
- **Password**: `MaryMcHale`

## Architecture

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   Frontend      │        │   Web API       │        │   Scanner       │
│   (React +      │◄─────► │   (FastAPI +    │◄─────► │   Container     │
│   TypeScript)   │        │   Auth)         │        │   (Python)      │
│   Port: 3000    │        │   Port: 8000    │        │   Docker        │
└─────────────────┘        └─────────────────┘        └─────────────────┘
          │                         │                         │
          │                         ▼                         │
          │                ┌─────────────────┐                │
          │                │     Redis       │                │
          └───────────────►│   (Caching)     │◄───────────────┘
                           │   Port: 6379    │
                           └─────────────────┘
```

### Components
- **Nginx Reverse Proxy**: Routes requests and serves static files on port 3000
- **React Frontend**: Modern UI with real-time scan progress tracking
- **FastAPI Backend**: RESTful API with JWT authentication and security controls
- **Redis**: Caching and session management
- **Scanner Container**: Isolated Python container for security testing

## Key Features

### **Security Testing**
- **OWASP API Security Top 10**: Comprehensive coverage of API vulnerabilities
- **Authentication Testing**: JWT token validation and auth bypass detection
- **Rate Limiting**: Protection against scan abuse
- **Input Validation**: Secure file upload and parameter validation

### **Real-time Monitoring**
- **Live Progress Updates**: Real-time scan progress with TanStack Query
- **Detailed Logging**: Comprehensive security event logging
- **Result Visualization**: Clear presentation of security findings

### **Production Ready**
- **Docker Deployment**: Containerized architecture with docker-compose
- **AWS Cloud Ready**: Deployed on EC2 with proper security groups
- **Environment Management**: Secure credential handling
- **Error Handling**: Robust error recovery and user feedback

## Quick Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd ScannerApp
   ```

2. **Start development environment**:
   ```bash
   # Recommended - handles setup automatically
   ./start-dev.sh
   
   # Or manually with docker compose
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   docker compose --profile build-only build scanner
   docker compose up -d
   ```

3. **Access application**:
   - Frontend: http://localhost:3000
   - API docs: http://localhost:3000/api/docs

## Deployment

### AWS Deployment
See [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for complete AWS deployment instructions.

### Local Docker
```bash
# Build and start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

## Security Features

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- Role-based access control (admin/user)
- Secure credential validation
- Session management with Redis

### Input Validation
- File upload restrictions (size, type, content)
- URL validation with private IP blocking
- Path traversal protection
- Request rate limiting

### Container Security
- Non-root container execution
- Resource limits (CPU, memory)
- Network isolation
- Temporary filesystem restrictions

## API Documentation

Once running, visit `/api/docs` for interactive API documentation with:
- Authentication endpoints
- Scan management
- Real-time status tracking
- Result retrieval

## Configuration

### Environment Variables
Create `.env.local` from `.env.local.example`:
```bash
# Security
JWT_SECRET=your-secret-key
ADMIN_USERNAME=your-admin-user
ADMIN_PASSWORD=your-secure-password

# Application
ENVIRONMENT=development
DEBUG=true
```

### Scanner Settings
- **Request Rate**: 1-2 RPS to avoid overwhelming targets
- **Max Requests**: Configurable budget (10-500 requests)
- **Timeout**: 12 second request timeout
- **Parallel Workers**: 3 simulated workers for progress tracking

## Development

### Project Structure
```
ScannerApp/
├── frontend/          # React TypeScript application
├── scanner-service/   # FastAPI backend and scanner
├── deploy/           # AWS deployment scripts
├── docker-compose.yml # Container orchestration
├── nginx.conf        # Reverse proxy configuration
└── venti_wrapper.py  # Main scanner wrapper
```

### Recent Fixes
- Fixed "Scan Failed: Unknown error occurred" by properly handling request budget exhaustion
- Enhanced error handling in scanner container
- Improved logging and debugging capabilities

See [development-log.md](./development-log.md) for detailed fix documentation.

## Documentation

- **[AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)**: Complete AWS deployment guide
- **[SECURITY.md](./SECURITY.md)**: Security implementation details
- **[SECRETS.md](./SECRETS.md)**: Secrets management guide
- **[development-log.md](./development-log.md)**: Recent fixes and changes

## License

This project is for educational purposes as part of MICS 259 Capstone project.