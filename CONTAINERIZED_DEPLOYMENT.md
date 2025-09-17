# Containerized Scanner Deployment Guide

## 🐳 How to Add New Scanners (Containerized Approach)

### Step 1: Create Scanner Directory

```bash
mkdir -p scanners/my-custom-scanner
cd scanners/my-custom-scanner
```

### Step 2: Create Dockerfile

```dockerfile
# scanners/my-custom-scanner/Dockerfile
FROM alpine:latest

# Install your scanner tool
RUN apk add --no-cache my-scanner-tool python3 py3-pip

# Install Python wrapper dependencies
COPY requirements.txt /app/
RUN pip3 install -r /app/requirements.txt

# Copy scanner wrapper
COPY scanner_wrapper.py /app/

# Standard volumes
VOLUME ["/input", "/output", "/shared"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 /app/scanner_wrapper.py --health-check || exit 1

# Entry point
ENTRYPOINT ["python3", "/app/scanner_wrapper.py"]
```

### Step 3: Create Scanner Wrapper

```python
# scanners/my-custom-scanner/scanner_wrapper.py
#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

class MyCustomScannerWrapper:
    def health_check(self):
        """Return health status"""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "scanner": "my-custom-scanner"
        }
    
    def scan(self, config):
        """Execute scan with standardized config"""
        scan_id = config["scan_id"]
        target = config["target"]["url"]
        
        # Your scanner logic here
        cmd = ["my-scanner-tool", "--target", target]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Return standardized format
        return {
            "scan_id": scan_id,
            "status": "completed" if result.returncode == 0 else "failed",
            "findings": self._parse_findings(result.stdout),
            "metadata": {"scanner": "my-custom-scanner"}
        }

# Main entry point handling
if __name__ == "__main__":
    wrapper = MyCustomScannerWrapper()
    
    if "--health-check" in sys.argv:
        print(json.dumps(wrapper.health_check()))
        sys.exit(0)
    
    # Read config and execute scan
    config = json.load(sys.stdin)
    result = wrapper.scan(config)
    print(json.dumps(result))
```

### Step 4: Create Manifest

```yaml
# scanner-manifests/my-custom-scanner.yaml
name: "My Custom Scanner"
version: "1.0.0"
type: "custom"
image: "my-custom-scanner:latest"
description: "Description of what this scanner does"
capabilities:
  targets: ["web", "api"]
  formats: ["url", "openapi"]
  parallel: false
  auth: true
resources:
  memory: "256Mi"
  cpu: "500m"
  timeout: 300
volumes:
  - "/shared/specs:/input:ro"
  - "/shared/results:/output:rw"
environment:
  - "SCANNER_MODE=container"
healthcheck:
  command: ["--health-check"]
  interval: 30
```

### Step 5: Build and Deploy

```bash
# Build the scanner container
./build-scanners.sh

# Or build individually
docker build -t my-custom-scanner:latest scanners/my-custom-scanner/

# Test health check
docker run --rm my-custom-scanner:latest --health-check

# The scanner will be automatically discovered by the container manager
```

## 🚀 Quick Start

### 1. Build All Scanners

```bash
# Build all scanner containers
./build-scanners.sh
```

### 2. Start Development Environment

```bash
# Start main application
./start-dev.sh

# Start scanner registry (optional)
docker-compose -f docker-compose.scanners.yml up -d
```

### 3. Test Containerized Scanners

```bash
# List available scanners
curl http://localhost:8000/api/v2/scanners

# Start a scan with specific scanner
curl -X POST http://localhost:8000/api/v2/scan/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "target_url=https://api.example.com" \
  -F "scanner_type=nuclei"
```

## 🔧 Management Commands

### Build Specific Scanner

```bash
cd scanners/nuclei-scanner
docker build -t nuclei-scanner:latest .
```

### Test Scanner Manually

```bash
# Create test config
echo '{
  "scan_id": "test-123",
  "target": {"url": "https://httpbin.org"},
  "config": {"max_requests": 10, "requests_per_second": 1}
}' > test-config.json

# Run scanner with test config
docker run --rm -v $(pwd):/shared nuclei-scanner:latest < test-config.json
```

### Update Scanner Templates

```bash
# For Nuclei scanner
docker run --rm nuclei-scanner:latest nuclei -update-templates
docker commit $(docker ps -lq) nuclei-scanner:latest
```

### Monitor Scanner Performance

```bash
# View running scanner containers
docker ps | grep scanner

# Monitor resource usage
docker stats $(docker ps --format "{{.Names}}" | grep scanner)

# View scanner logs
docker logs nuclei-scanner-test-123
```

## 📊 Container Architecture Benefits

### ✅ **Isolation**
- Each scanner runs in its own container
- No dependency conflicts between scanners
- Security boundaries between scanner tools
- Resource limits per scanner

### ✅ **Scalability**
- Independent scaling per scanner type
- Kubernetes-ready for production
- Load balancing across scanner instances
- Auto-scaling based on demand

### ✅ **Maintainability**
- Individual scanner updates without affecting others
- Version management per scanner
- Easy rollback for problematic scanner versions
- Independent testing and validation

### ✅ **Flexibility**
- Different programming languages per scanner
- Custom environments and dependencies
- Easy integration of third-party tools
- Support for legacy scanning tools

## 🏭 Production Deployment

### Kubernetes Deployment

```yaml
# k8s/scanner-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nuclei-scanner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nuclei-scanner
  template:
    metadata:
      labels:
        app: nuclei-scanner
    spec:
      containers:
      - name: nuclei-scanner
        image: registry.company.com/nuclei-scanner:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
        volumeMounts:
        - name: shared-results
          mountPath: /output
        - name: shared-specs
          mountPath: /input
        readinessProbe:
          exec:
            command: ["python3", "/app/scanner_wrapper.py", "--health-check"]
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Docker Swarm Deployment

```yaml
# docker-stack.yml
version: '3.8'
services:
  nuclei-scanner:
    image: nuclei-scanner:latest
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
      restart_policy:
        condition: on-failure
    volumes:
      - shared-results:/output
      - shared-specs:/input
    networks:
      - scanner-network
```

## 🔍 Debugging

### Container Issues

```bash
# Check if container starts
docker run --rm nuclei-scanner:latest --health-check

# Debug container interactively
docker run -it --rm nuclei-scanner:latest sh

# View container logs
docker logs scanner-container-name

# Inspect container configuration
docker inspect nuclei-scanner:latest
```

### Scanner Integration Issues

```bash
# Test scanner discovery
curl http://localhost:8000/api/v2/scanners

# Check container manager logs
docker logs ventiapi-web-api

# Verify shared volumes
ls -la shared/results/
ls -la shared/specs/
```

## 🎯 Next Steps

1. **Add More Scanners**: Create containers for OWASP ZAP, Nikto, etc.
2. **Enhance Orchestration**: Add Kubernetes support for production
3. **Improve Monitoring**: Add metrics and alerting for scanner performance
4. **Security Hardening**: Implement scanner container security policies
5. **Template Management**: Dynamic template updates for scanners like Nuclei

This containerized approach provides a robust, scalable foundation for building a comprehensive security scanning platform that can easily integrate new tools while maintaining isolation and performance.