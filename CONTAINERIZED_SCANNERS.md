# Containerized Scanner Architecture

## 🐳 Docker-Based Scanner Plugins

Each scanner runs in its own Docker container with standardized interfaces.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Main API       │    │ Container       │
│   (React)       │────│  (FastAPI)      │────│ Orchestrator    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                         ┌──────────────────────────────┼──────────────────────────────┐
                         │                              │                              │
                ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
                │  venti-scanner  │            │   zap-scanner   │            │ nuclei-scanner  │
                │   Container     │            │   Container     │            │   Container     │
                │                 │            │                 │            │                 │
                │ ┌─────────────┐ │            │ ┌─────────────┐ │            │ ┌─────────────┐ │
                │ │   Scanner   │ │            │ │   OWASP     │ │            │ │   Nuclei    │ │
                │ │    API      │ │            │ │     ZAP     │ │            │ │    Tool     │ │
                │ └─────────────┘ │            │ └─────────────┘ │            │ └─────────────┘ │
                └─────────────────┘            └─────────────────┘            └─────────────────┘
```

## 📋 Container Standards

### 1. Standardized Input/Output

All scanner containers must implement:

**Input**: JSON configuration via stdin or file
```json
{
  "scan_id": "uuid",
  "target": {
    "url": "https://api.example.com",
    "spec_file": "/input/openapi.json",
    "auth": {...}
  },
  "config": {
    "max_requests": 100,
    "rps": 1.0,
    "dangerous": false
  }
}
```

**Output**: Standardized JSON results
```json
{
  "scan_id": "uuid",
  "status": "completed",
  "findings": [...],
  "metadata": {...}
}
```

### 2. Container Interface

```dockerfile
# Standard scanner container structure
FROM alpine:latest

# Install scanner tool
RUN apk add --no-cache scanner-tool

# Copy wrapper script
COPY scanner_wrapper.py /app/
COPY requirements.txt /app/
RUN pip install -r /app/requirements.txt

# Standard volumes
VOLUME ["/input", "/output", "/shared"]

# Standard entrypoint
ENTRYPOINT ["python", "/app/scanner_wrapper.py"]
```

### 3. Health Check Endpoint

Each container exposes a health check:
```bash
docker run --rm scanner-image:latest --health-check
# Returns: {"status": "healthy", "version": "1.0.0"}
```

## 🔧 Implementation

### 1. Container Registry Structure

```
docker-registry/
├── venti-scanner:latest
├── zap-scanner:latest  
├── nuclei-scanner:latest
├── nikto-scanner:latest
└── custom-scanner:latest
```

### 2. Scanner Manifest

Each scanner has a manifest file:

```yaml
# scanners/zap-scanner/manifest.yaml
name: "OWASP ZAP Scanner"
version: "1.0.0"
image: "zap-scanner:latest"
capabilities:
  targets: ["web", "api"]
  formats: ["openapi", "url"]
  parallel: false
  auth: true
resources:
  memory: "1Gi"
  cpu: "500m"
  timeout: 1800
volumes:
  - "/shared/specs:/input:ro"
  - "/shared/results:/output:rw"
environment:
  - "ZAP_PORT=8080"
healthcheck:
  command: ["--health-check"]
  interval: 30
```

### 3. Container Manager

```python
# scanner_plugins/container_manager.py
class ContainerManager:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.scanners = self._load_scanner_manifests()
    
    async def run_scanner(self, scanner_name: str, scan_config: dict):
        manifest = self.scanners[scanner_name]
        
        # Create container
        container = self.docker_client.containers.run(
            manifest["image"],
            detach=True,
            volumes=manifest["volumes"],
            environment=manifest["environment"],
            memory=manifest["resources"]["memory"],
            nano_cpus=self._parse_cpu(manifest["resources"]["cpu"]),
            name=f"{scanner_name}-{scan_config['scan_id']}",
            remove=True
        )
        
        # Pass configuration
        container.exec_run(
            f"echo '{json.dumps(scan_config)}' > /tmp/config.json"
        )
        
        return container
```

## 📦 Creating New Scanner Containers

### Step 1: Create Scanner Image

```dockerfile
# scanners/nuclei-scanner/Dockerfile
FROM golang:alpine AS builder

# Build Nuclei
RUN go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

FROM alpine:latest
RUN apk add --no-cache python3 py3-pip curl
COPY --from=builder /go/bin/nuclei /usr/bin/

# Install Python wrapper
COPY requirements.txt /app/
RUN pip3 install -r /app/requirements.txt

# Copy scanner wrapper
COPY nuclei_wrapper.py /app/scanner_wrapper.py
COPY templates/ /app/templates/

VOLUME ["/input", "/output", "/shared"]
WORKDIR /app

ENTRYPOINT ["python3", "scanner_wrapper.py"]
```

### Step 2: Create Scanner Wrapper

```python
# scanners/nuclei-scanner/nuclei_wrapper.py
#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

class NucleiWrapper:
    def __init__(self):
        self.input_dir = Path("/input")
        self.output_dir = Path("/output")
    
    def health_check(self):
        """Health check endpoint"""
        try:
            result = subprocess.run(['nuclei', '-version'], 
                                  capture_output=True, text=True)
            return {
                "status": "healthy",
                "version": result.stdout.strip(),
                "scanner": "nuclei"
            }
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
    
    def scan(self, config):
        """Execute Nuclei scan"""
        scan_id = config["scan_id"]
        target = config["target"]["url"]
        
        # Build Nuclei command
        cmd = [
            'nuclei',
            '-target', target,
            '-json',
            '-output', f'/output/{scan_id}/findings.json',
            '-templates', '/app/templates/',
            '-rate-limit', str(int(config["config"]["rps"])),
            '-bulk-size', str(config["config"]["max_requests"])
        ]
        
        if config["config"]["dangerous"]:
            cmd.append('-severe')
        
        # Execute scan
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            return self._process_results(scan_id)
        else:
            return {
                "scan_id": scan_id,
                "status": "failed",
                "error": result.stderr
            }
    
    def _process_results(self, scan_id):
        """Process Nuclei output to standard format"""
        results_file = self.output_dir / scan_id / "findings.json"
        
        if not results_file.exists():
            return {
                "scan_id": scan_id,
                "status": "completed",
                "findings": []
            }
        
        # Parse Nuclei JSON output
        findings = []
        with open(results_file) as f:
            for line in f:
                try:
                    nuclei_finding = json.loads(line)
                    finding = self._normalize_finding(nuclei_finding)
                    findings.append(finding)
                except:
                    continue
        
        return {
            "scan_id": scan_id,
            "status": "completed", 
            "findings": findings,
            "metadata": {
                "scanner": "nuclei",
                "total_findings": len(findings)
            }
        }
    
    def _normalize_finding(self, nuclei_finding):
        """Convert Nuclei finding to standard format"""
        return {
            "id": f"nuclei-{nuclei_finding.get('template-id')}",
            "title": nuclei_finding.get("info", {}).get("name"),
            "description": nuclei_finding.get("info", {}).get("description"),
            "severity": nuclei_finding.get("info", {}).get("severity", "info").upper(),
            "category": nuclei_finding.get("info", {}).get("classification", {}).get("cve-id", "unknown"),
            "endpoint": nuclei_finding.get("matched-at"),
            "method": "GET",  # Nuclei default
            "evidence": {
                "template": nuclei_finding.get("template-id"),
                "matcher": nuclei_finding.get("matcher-name"),
                "extracted": nuclei_finding.get("extracted-results")
            }
        }

if __name__ == "__main__":
    wrapper = NucleiWrapper()
    
    if "--health-check" in sys.argv:
        print(json.dumps(wrapper.health_check()))
        sys.exit(0)
    
    # Read configuration
    config_file = Path("/tmp/config.json")
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
    else:
        config = json.load(sys.stdin)
    
    # Execute scan
    result = wrapper.scan(config)
    print(json.dumps(result))
```

### Step 3: Create Manifest

```yaml
# scanners/nuclei-scanner/manifest.yaml
name: "Nuclei Scanner"
version: "1.0.0"
image: "nuclei-scanner:latest"
description: "Fast vulnerability scanner based on templates"
capabilities:
  targets: ["web", "api"]
  formats: ["url"]
  parallel: true
  auth: false
resources:
  memory: "512Mi"
  cpu: "500m"
  timeout: 600
volumes:
  - "/shared/specs:/input:ro"
  - "/shared/results:/output:rw"
environment:
  - "NUCLEI_CONFIG=/app/nuclei.yaml"
healthcheck:
  command: ["--health-check"]
  interval: 30
```

### Step 4: Build and Register

```bash
# Build container
cd scanners/nuclei-scanner
docker build -t nuclei-scanner:latest .

# Test health check
docker run --rm nuclei-scanner:latest --health-check

# Register with scanner manager
cp manifest.yaml /app/scanner-manifests/nuclei-scanner.yaml
```

## 🔄 Container Orchestration

### Local Development (Docker Compose)

```yaml
# docker-compose.scanners.yml
services:
  scanner-registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - registry-data:/var/lib/registry

  venti-scanner:
    build: ./scanners/venti-scanner
    image: localhost:5000/venti-scanner:latest
    volumes:
      - shared-results:/output
      - shared-specs:/input

  zap-scanner:
    build: ./scanners/zap-scanner  
    image: localhost:5000/zap-scanner:latest
    volumes:
      - shared-results:/output
      - shared-specs:/input

  nuclei-scanner:
    build: ./scanners/nuclei-scanner
    image: localhost:5000/nuclei-scanner:latest
    volumes:
      - shared-results:/output
      - shared-specs:/input
```

### Production (Kubernetes)

```yaml
# k8s/scanner-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nuclei-scanner
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: nuclei-scanner
        image: registry.company.com/nuclei-scanner:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: shared-results
          mountPath: /output
        - name: shared-specs
          mountPath: /input
```

## 🎯 Benefits of Containerized Approach

### **Isolation**
- ✅ Each scanner runs in isolation
- ✅ No dependency conflicts
- ✅ Security boundaries
- ✅ Resource limits

### **Scalability**  
- ✅ Independent scaling per scanner
- ✅ Kubernetes orchestration
- ✅ Auto-scaling based on demand
- ✅ Load balancing

### **Maintenance**
- ✅ Individual scanner updates
- ✅ Version management
- ✅ Easy rollback
- ✅ Health monitoring

### **Flexibility**
- ✅ Different languages/tools per scanner
- ✅ Custom scanner environments
- ✅ Third-party scanner integration
- ✅ Legacy tool support

## 📋 Adding a New Scanner Checklist

1. **Create scanner directory**: `scanners/my-scanner/`
2. **Write Dockerfile**: Build scanner with wrapper
3. **Create wrapper script**: Implement standard interface
4. **Create manifest.yaml**: Define capabilities and resources
5. **Build and test**: `docker build` and health check
6. **Register**: Copy manifest to scanner registry
7. **Deploy**: Add to docker-compose or K8s

This containerized approach provides much better isolation, scalability, and maintainability compared to the monolithic plugin approach!