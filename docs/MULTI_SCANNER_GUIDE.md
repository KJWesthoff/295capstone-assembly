# Multi-Scanner Integration Guide

This guide explains how to use multiple security scanners (VentiAPI + ZAP) in parallel with the VentiAPI Scanner application.

## Overview

The application now supports running multiple scanner engines simultaneously:
- **VentiAPI Scanner**: OWASP API Security Top 10 focused scanner
- **OWASP ZAP**: Comprehensive web application security scanner

## Setup

### 1. Build Scanner Images

```bash
# Build both scanner images
docker compose --profile build-only build scanner zap

# Or build individually
docker compose --profile build-only build scanner
docker compose --profile build-only build zap
```

### 2. Start the Application

```bash
# Start the main application
docker compose up -d
```

## Usage

### API Endpoints

#### 1. Check Available Scanners
```bash
curl http://localhost:3000/api/scanners
```

Response:
```json
{
  "available_scanners": ["ventiapi", "zap"],
  "descriptions": {
    "ventiapi": "VentiAPI - OWASP API Security Top 10 focused scanner",
    "zap": "OWASP ZAP - Comprehensive web application security scanner"
  }
}
```

#### 2. Start Multi-Scanner Scan

**Single Scanner (VentiAPI only)**:
```bash
curl -X POST "http://localhost:3000/api/scan/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "server_url=https://api.example.com" \
  -F "target_url=https://api.example.com" \
  -F "scanners=ventiapi" \
  -F "spec_file=@openapi.yml"
```

**Multiple Scanners (VentiAPI + ZAP)**:
```bash
curl -X POST "http://localhost:3000/api/scan/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "server_url=https://api.example.com" \
  -F "target_url=https://api.example.com" \
  -F "scanners=ventiapi,zap" \
  -F "spec_file=@openapi.yml"
```

**ZAP Only**:
```bash
curl -X POST "http://localhost:3000/api/scan/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "server_url=https://api.example.com" \
  -F "target_url=https://api.example.com" \
  -F "scanners=zap" \
  -F "spec_file=@openapi.yml"
```

#### 3. Monitor Scan Progress

```bash
curl "http://localhost:3000/api/scan/{scan_id}/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response will show progress for each scanner:
```json
{
  "scan_id": "abc-123",
  "status": "running",
  "scanners": ["ventiapi", "zap"],
  "total_chunks": 2,
  "chunk_status": [
    {
      "chunk_id": 0,
      "scanner": "ventiapi",
      "status": "running",
      "progress": 75
    },
    {
      "chunk_id": 1,
      "scanner": "zap", 
      "status": "completed",
      "progress": 100
    }
  ]
}
```

## Scanner-Specific Options

### VentiAPI Scanner Options
- `dangerous`: Enable dangerous tests (admin only)
- `fuzz_auth`: Enable authentication fuzzing
- `rps`: Requests per second (default: 2.0)
- `max_requests`: Maximum requests (default: 400)

### ZAP Scanner Options
- `passive_scan`: Enable passive scanning (default: true)
- `quick_scan`: Enable quick scan mode (default: true)
- `update_addons`: Update ZAP addons (default: false)

## Results

### Result Files
Each scanner creates its own result files:

**VentiAPI Results**:
- `/shared/results/{scan_id}_ventiapi/` - VentiAPI findings
- Includes JSON and HTML reports

**ZAP Results**:
- `/shared/results/{scan_id}_zap.json` - ZAP JSON report
- `/shared/results/{scan_id}_zap.html` - ZAP HTML report

### Unified Results
The scan status includes detailed results from all scanners:
```json
{
  "scanner_results": {
    "scan_id": "abc-123",
    "engines": ["ventiapi", "zap"],
    "overall_status": "completed",
    "results": {
      "ventiapi": {
        "status": "completed",
        "result_path": "/shared/results/abc-123_ventiapi"
      },
      "zap": {
        "status": "completed", 
        "result_path": "/shared/results/abc-123_zap",
        "json_report": "/shared/results/abc-123_zap.json",
        "html_report": "/shared/results/abc-123_zap.html"
      }
    }
  }
}
```

## Frontend Integration

### Form Fields
Add a scanner selection field to your scan form:

```html
<select name="scanners" multiple>
  <option value="ventiapi" selected>VentiAPI Scanner</option>
  <option value="zap">OWASP ZAP</option>
</select>
```

### JavaScript Example
```javascript
// Get available scanners
const scanners = await fetch('/api/scanners').then(r => r.json());

// Start multi-scanner scan
const formData = new FormData();
formData.append('server_url', 'https://api.example.com');
formData.append('scanners', 'ventiapi,zap');
formData.append('spec_file', file);

const scan = await fetch('/api/scan/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
}).then(r => r.json());
```

## Troubleshooting

### Common Issues

1. **Scanner image not found**:
   ```bash
   # Build missing scanner images
   docker compose --profile build-only build zap
   ```

2. **Volume mount issues**:
   - Check volume names match between environments
   - Local: `scannerapp_shared-*`
   - AWS: `ventiapi_shared-*`

3. **ZAP scanner fails**:
   - Ensure target URL is accessible
   - Check if OpenAPI spec is valid
   - Review ZAP logs in scan results

### Debugging

Check scanner container logs:
```bash
# Check running scanner containers
docker ps | grep scanner

# Check specific container logs
docker logs scanner-{scan_id}
docker logs zap-scanner-{scan_id}
```

## Adding New Scanners

To add a new scanner engine:

1. Create a new class extending `ScannerEngine` in `scanner_engines.py`
2. Implement `get_docker_command()` and `scan()` methods
3. Add the scanner to `MultiScannerManager.engines`
4. Create a Dockerfile for the scanner
5. Update docker-compose.yml with build configuration
6. Update documentation

Example:
```python
class NucleiScanner(ScannerEngine):
    def __init__(self):
        super().__init__("nuclei")
        self.image = "projectdiscovery/nuclei"
    
    def get_docker_command(self, scan_id, spec_path, target_url, options):
        # Implementation here
        pass
```