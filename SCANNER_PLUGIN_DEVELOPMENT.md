# 🔌 Scanner Plugin Development Guide

This guide provides comprehensive instructions for developing security scanner plugins for the VentiAPI Scanner platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Base Requirements](#base-requirements)
- [Implementation Interface](#implementation-interface)
- [Scanner Types](#scanner-types)
- [Development Workflow](#development-workflow)
- [Testing Guide](#testing-guide)
- [Deployment](#deployment)
- [Examples](#examples)
- [Best Practices](#best-practices)

## 🔍 Overview

The VentiAPI Scanner platform uses a plugin-based architecture that allows developers to integrate custom security scanners. Plugins provide a standardized interface for different scanning tools while maintaining flexibility for tool-specific configurations.

### Supported Plugin Types

1. **Microservice Scanners** - Dedicated services (Nuclei, OWASP ZAP)
2. **Local Scanners** - Direct tool integration (VentiAPI)
3. **Container Scanners** - Docker-based scanning tools
4. **Custom Scanners** - Your own security testing logic

## 🏗️ Plugin Architecture

```
scanner-service/web-api/scanner_plugins/
├── base.py                 # Base classes and interfaces
├── manager.py             # Plugin manager and coordination
├── microservice_scanner.py   # Microservice base class
├── venti_scanner.py       # VentiAPI scanner implementation
└── your_scanner.py        # Your custom scanner
```

### Core Components

- **BaseScanner**: Abstract base class for all scanners
- **ScannerManager**: Coordinates multiple scanners
- **ScanTarget**: Defines what to scan
- **ScanConfig**: Scanner configuration
- **ScanResult**: Standardized results format
- **SecurityFinding**: Individual vulnerability finding

## ⚡ Base Requirements

### Dependencies

```python
from scanner_plugins.base import (
    BaseScanner, ScannerType, ScanTarget, ScanConfig, 
    ScanResult, SecurityFinding, SeverityLevel
)
```

### Required Methods

Every scanner plugin must implement:

```python
class YourScanner(BaseScanner):
    def validate_target(self, target: ScanTarget) -> bool
    def validate_config(self, config: ScanConfig) -> bool
    async def scan(self, scan_id: str, target: ScanTarget, 
                   config: ScanConfig, progress_callback=None) -> ScanResult
    async def health_check(self) -> bool
    async def stop_scan(self, scan_id: str) -> bool
    def get_scanner_info(self) -> Dict[str, Any]
```

## 🔧 Implementation Interface

### 1. Scanner Class Definition

```python
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import asyncio

class CustomScanner(BaseScanner):
    """Custom Security Scanner Plugin"""
    
    def __init__(self, config_param: str = "default"):
        super().__init__(
            name="Custom Scanner",
            scanner_type=ScannerType.CUSTOM  # Define your scanner type
        )
        self.config_param = config_param
        self.timeout = 300
        self.logger = logging.getLogger(__name__)
```

### 2. Target Validation

```python
def validate_target(self, target: ScanTarget) -> bool:
    """Validate if this scanner can scan the target"""
    # Check URL format
    if not target.url or not target.url.startswith(('http://', 'https://')):
        return False
    
    # Check target type compatibility
    if target.target_type not in ["web", "api"]:
        return False
    
    # Add your custom validation logic
    return True
```

### 3. Configuration Validation

```python
def validate_config(self, config: ScanConfig) -> bool:
    """Validate scan configuration"""
    # Check resource limits
    if config.max_requests > 1000 or config.max_requests < 1:
        return False
    
    if config.timeout > 3600 or config.timeout < 30:
        return False
    
    # Add scanner-specific validation
    return True
```

### 4. Main Scan Implementation

```python
async def scan(
    self,
    scan_id: str,
    target: ScanTarget,
    config: ScanConfig,
    progress_callback: Optional[Callable] = None
) -> ScanResult:
    """Execute the security scan"""
    
    start_time = datetime.utcnow()
    
    try:
        # Initialize scan result
        result = ScanResult(
            scan_id=scan_id,
            scanner_type=self.scanner_type,
            status="running",
            target=target,
            config=config,
            findings=[],
            metadata={},
            started_at=start_time
        )
        
        # Progress reporting
        if progress_callback:
            await progress_callback(scan_id, 10, "Starting scan")
        
        # Your scanning logic here
        findings = await self._execute_scan(target, config, progress_callback)
        
        # Complete the scan
        result.status = "completed"
        result.findings = findings
        result.completed_at = datetime.utcnow()
        result.metadata = {
            "total_findings": len(findings),
            "duration_seconds": (result.completed_at - start_time).total_seconds(),
            "scanner_version": "1.0.0"
        }
        
        if progress_callback:
            await progress_callback(scan_id, 100, "Scan completed")
        
        return result
        
    except Exception as e:
        # Handle errors gracefully
        self.logger.error(f"Scan failed: {e}")
        return ScanResult(
            scan_id=scan_id,
            scanner_type=self.scanner_type,
            status="failed",
            target=target,
            config=config,
            findings=[],
            metadata={},
            started_at=start_time,
            completed_at=datetime.utcnow(),
            error_message=str(e)
        )
```

### 5. Scanner-Specific Logic

```python
async def _execute_scan(
    self, 
    target: ScanTarget, 
    config: ScanConfig,
    progress_callback: Optional[Callable] = None
) -> List[SecurityFinding]:
    """Implement your scanning logic"""
    
    findings = []
    
    # Example: Check for common vulnerabilities
    if progress_callback:
        await progress_callback(None, 25, "Checking security headers")
    
    # Your security testing logic
    missing_headers = await self._check_security_headers(target.url)
    if missing_headers:
        finding = SecurityFinding(
            id="custom-001",
            title="Missing Security Headers",
            description="Critical security headers are missing",
            severity=SeverityLevel.MEDIUM,
            category="security-misconfiguration",
            endpoint=target.url,
            method="GET",
            evidence={"missing_headers": missing_headers},
            references=["https://owasp.org/www-project-secure-headers/"]
        )
        findings.append(finding)
    
    if progress_callback:
        await progress_callback(None, 50, "Testing for injection vulnerabilities")
    
    # Add more tests...
    
    return findings
```

### 6. Health Check

```python
async def health_check(self) -> bool:
    """Check if scanner is ready to use"""
    try:
        # Check external dependencies
        if hasattr(self, 'external_service_url'):
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.external_service_url}/health")
                return response.status_code == 200
        
        # Check local dependencies
        return True
        
    except Exception as e:
        self.logger.error(f"Health check failed: {e}")
        return False
```

### 7. Scanner Information

```python
def get_scanner_info(self) -> Dict[str, Any]:
    """Return scanner metadata"""
    return {
        "name": self.name,
        "type": self.scanner_type.value,
        "version": "1.0.0",
        "capabilities": ["web", "api"],
        "supported_targets": ["http", "https"],
        "description": "Custom security scanner for specialized testing",
        "status": "available",
        "author": "Your Name",
        "documentation": "https://your-docs.com"
    }
```

## 🏷️ Scanner Types

Define your scanner type in the `ScannerType` enum:

```python
# In base.py
class ScannerType(Enum):
    VENTI_API = "venti-api"
    NUCLEI = "nuclei"
    ZAP = "zap"
    CUSTOM = "custom"          # Add your scanner type
    BURP_SUITE = "burp-suite"  # Example additional type
```

## 🔄 Development Workflow

### 1. Setup Development Environment

```bash
cd scanner-service/web-api/scanner_plugins/
cp venti_scanner.py my_scanner.py
```

### 2. Implement Scanner Class

```python
# my_scanner.py
from .base import BaseScanner, ScannerType

class MyScanner(BaseScanner):
    def __init__(self):
        super().__init__(
            name="My Custom Scanner",
            scanner_type=ScannerType.CUSTOM
        )
    
    # Implement required methods...
```

### 3. Register Scanner

```python
# In manager.py
def _register_scanners(self):
    try:
        # ... existing scanners ...
        
        # Register your scanner
        from .my_scanner import MyScanner
        my_scanner = MyScanner()
        self.scanners[ScannerType.CUSTOM] = my_scanner
        self.logger.info(f"Registered scanner: {my_scanner.name}")
        
    except ImportError as e:
        self.logger.warning(f"Custom scanner not available: {e}")
```

### 4. Test Integration

```python
# Test your scanner
async def test_scanner():
    from scanner_plugins.manager import scanner_manager
    
    target = ScanTarget(
        url="https://httpbin.org",
        target_type="web"
    )
    
    config = ScanConfig(
        max_requests=10,
        timeout=60
    )
    
    result = await scanner_manager.start_scan(
        scan_id="test-123",
        target=target,
        config=config,
        scanner_type=ScannerType.CUSTOM
    )
    
    print(f"Scan result: {result.status}")
    print(f"Findings: {len(result.findings)}")
```

## 🧪 Testing Guide

### Unit Tests

```python
import pytest
from scanner_plugins.my_scanner import MyScanner
from scanner_plugins.base import ScanTarget, ScanConfig

@pytest.fixture
def scanner():
    return MyScanner()

@pytest.fixture
def target():
    return ScanTarget(
        url="https://httpbin.org",
        target_type="web"
    )

@pytest.fixture
def config():
    return ScanConfig(
        max_requests=5,
        timeout=30
    )

@pytest.mark.asyncio
async def test_scanner_validation(scanner, target, config):
    assert scanner.validate_target(target) == True
    assert scanner.validate_config(config) == True

@pytest.mark.asyncio
async def test_health_check(scanner):
    health = await scanner.health_check()
    assert isinstance(health, bool)

@pytest.mark.asyncio
async def test_scan_execution(scanner, target, config):
    result = await scanner.scan("test-123", target, config)
    assert result.status in ["completed", "failed"]
    assert isinstance(result.findings, list)
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_scanner_integration():
    from scanner_plugins.manager import scanner_manager
    
    # Test scanner registration
    scanners = scanner_manager.get_available_scanners()
    custom_scanner = next((s for s in scanners if s["type"] == "custom"), None)
    assert custom_scanner is not None
    
    # Test scan execution
    target = ScanTarget(url="https://httpbin.org", target_type="web")
    config = ScanConfig()
    
    result = await scanner_manager.start_scan(
        scan_id="integration-test",
        target=target,
        config=config,
        scanner_type=ScannerType.CUSTOM
    )
    
    assert result.status == "completed"
```

## 🚀 Deployment

### 1. Microservice Scanner

For external services, create a dedicated microservice:

```python
# scanner-services/my-service/main.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="My Scanner Service")

class ScanRequest(BaseModel):
    target_url: str
    options: dict = {}

@app.post("/scan/start")
async def start_scan(request: ScanRequest):
    # Implement scan logic
    return {"scan_id": "uuid", "status": "started"}

@app.get("/scan/{scan_id}/status")
async def get_status(scan_id: str):
    # Return scan status
    return {"scan_id": scan_id, "status": "completed"}

@app.get("/scan/{scan_id}/findings")
async def get_findings(scan_id: str):
    # Return findings
    return {"findings": [], "total": 0}
```

### 2. Container Deployment

```dockerfile
# scanner-services/my-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
EXPOSE 8003

CMD ["python", "main.py"]
```

### 3. Docker Compose Integration

```yaml
# docker-compose.yml
services:
  my-scanner-service:
    build: ./scanner-services/my-service
    ports:
      - "8003:8003"
    environment:
      - PORT=8003
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 📚 Examples

### Simple Web Scanner

```python
class SimpleWebScanner(BaseScanner):
    def __init__(self):
        super().__init__("Simple Web Scanner", ScannerType.CUSTOM)
    
    async def scan(self, scan_id, target, config, progress_callback=None):
        findings = []
        
        # Check for common web vulnerabilities
        async with httpx.AsyncClient() as client:
            # Test for directory traversal
            response = await client.get(f"{target.url}/../etc/passwd")
            if "root:" in response.text:
                findings.append(SecurityFinding(
                    id="web-001",
                    title="Directory Traversal",
                    description="Server vulnerable to directory traversal",
                    severity=SeverityLevel.HIGH,
                    category="path-traversal",
                    endpoint=target.url,
                    evidence={"response": response.text[:200]}
                ))
        
        return ScanResult(
            scan_id=scan_id,
            scanner_type=self.scanner_type,
            status="completed",
            target=target,
            config=config,
            findings=findings,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
```

### API Security Scanner

```python
class APISecurityScanner(BaseScanner):
    def __init__(self):
        super().__init__("API Security Scanner", ScannerType.CUSTOM)
    
    async def scan(self, scan_id, target, config, progress_callback=None):
        findings = []
        
        # Test API endpoints
        if target.spec_file:  # OpenAPI spec available
            spec = await self._load_openapi_spec(target.spec_file)
            
            for path, methods in spec.get("paths", {}).items():
                endpoint_url = f"{target.url}{path}"
                
                for method, details in methods.items():
                    # Test for authentication bypass
                    finding = await self._test_auth_bypass(endpoint_url, method)
                    if finding:
                        findings.append(finding)
                    
                    # Test for injection vulnerabilities
                    finding = await self._test_injection(endpoint_url, method, details)
                    if finding:
                        findings.append(finding)
        
        return ScanResult(
            scan_id=scan_id,
            scanner_type=self.scanner_type,
            status="completed",
            target=target,
            config=config,
            findings=findings,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
```

## ✅ Best Practices

### Security

- **Input Validation**: Always validate target URLs and configuration
- **Error Handling**: Gracefully handle network errors and timeouts
- **Resource Limits**: Respect rate limits and resource constraints
- **Credential Security**: Never log or expose authentication credentials

### Performance

- **Async Operations**: Use `async/await` for non-blocking operations
- **Progress Reporting**: Provide regular progress updates
- **Resource Cleanup**: Properly close connections and clean up resources
- **Timeout Handling**: Implement appropriate timeout mechanisms

### Code Quality

- **Type Hints**: Use proper type annotations
- **Documentation**: Document your scanner's capabilities and limitations
- **Logging**: Use structured logging for debugging
- **Testing**: Write comprehensive unit and integration tests

### Integration

- **Standard Interface**: Follow the BaseScanner interface exactly
- **Error Reporting**: Provide clear error messages and context
- **Metadata**: Include comprehensive scanner information
- **Compatibility**: Test with different target types and configurations

### Example Testing

```python
# Test with various targets
targets = [
    ScanTarget(url="https://httpbin.org", target_type="web"),
    ScanTarget(url="https://api.github.com", target_type="api"),
    ScanTarget(url="https://jsonplaceholder.typicode.com", target_type="api", 
               spec_file="https://jsonplaceholder.typicode.com/swagger.json")
]

for target in targets:
    result = await scanner.scan("test", target, config)
    assert result.status in ["completed", "failed"]
```

## 🎯 Plugin Checklist

Before deploying your scanner plugin:

- [ ] Implements all required BaseScanner methods
- [ ] Handles errors gracefully with proper error messages
- [ ] Provides progress updates during scanning
- [ ] Validates input targets and configuration
- [ ] Includes comprehensive health checks
- [ ] Returns findings in standardized SecurityFinding format
- [ ] Includes proper logging for debugging
- [ ] Has unit tests with good coverage
- [ ] Works with the scanner manager integration
- [ ] Provides accurate scanner information and metadata
- [ ] Respects rate limits and resource constraints
- [ ] Handles timeouts appropriately
- [ ] Cleans up resources properly

---

## 📞 Support

For questions about plugin development:

- **Documentation**: Check the existing scanner implementations
- **Issues**: Open GitHub issues for bugs or feature requests
- **Examples**: Study `venti_scanner.py` and `microservice_scanner.py`

**Happy scanning! 🔍🛡️**