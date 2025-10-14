# Adding New Scanners to VentiAPI Scanner Service

This guide explains how to safely add new security scanners to the VentiAPI multi-scanner architecture without breaking existing functionality.

## Overview

The scanner service uses a modular architecture where each scanner implements the `ScannerEngine` abstract base class. Scanners run as on-demand Docker containers and return standardized results.

## Architecture

```
ScannerEngine (ABC)
├── VentiAPIScanner
├── ZAPScanner
├── NucleiScanner
└── YourNewScanner  <- Add here
```

## Step-by-Step Implementation Guide

### 1. Create Your Scanner Class

Add your scanner class directly to `scanner_engines.py` (avoid separate modules to prevent import issues):

```python
class YourNewScanner(ScannerEngine):
    """Your New Scanner Engine - Description of what it does"""
    
    def __init__(self):
        super().__init__("yournewscanner")  # Unique scanner name
        self.image = "your-scanner-image:latest"  # Docker image
    
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str, 
                          options: Dict[str, Any]) -> List[str]:
        """Generate Docker command for this scanner"""
        volume_prefix = options.get('volume_prefix', 'scannerapp')
        
        # Result path (inside container)
        result_path = f'/app/results/{scan_id}_yournewscanner.json'
        
        cmd = [
            'docker', 'run', '--rm',
            '--network', 'host',
            '--memory', '512m',  # Adjust as needed
            '--cpus', '0.5',     # Adjust as needed
            '--security-opt', 'no-new-privileges',
            '-v', f'{volume_prefix}_shared-results:/app/results:rw',
            f'--name', f'yournewscanner-{scan_id}',
            f'--label', f'scan_id={scan_id}',
            f'--label', 'app=yournewscanner',
            self.image,
            # Scanner-specific arguments
            '--target', target_url,
            '--output', result_path
        ]
        
        # Add scanner-specific options
        if options.get('verbose', False):
            cmd.append('--verbose')
        
        return cmd
    
    async def scan(self, scan_id: str, spec_path: str, target_url: str, 
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute scanner and return results"""
        cmd = self.get_docker_command(scan_id, spec_path, target_url, options)
        
        try:
            logger.info(f"🔍 Starting YourNewScanner: {' '.join(cmd[:10])}...")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            # Parse results if needed
            findings = await self._parse_results(scan_id, options.get('volume_prefix', 'scannerapp'))
            
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed" if process.returncode == 0 else "failed",
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "result_path": self.get_result_path(scan_id),
                "findings": findings,
                "findings_count": len(findings)
            }
            
        except Exception as e:
            logger.error(f"YourNewScanner failed: {e}")
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def _parse_results(self, scan_id: str, volume_prefix: str) -> List[Dict[str, Any]]:
        """Parse scanner results into standardized format"""
        findings = []
        
        try:
            result_file = Path(f"/shared/results/{scan_id}_yournewscanner.json")
            
            if result_file.exists():
                with open(result_file, 'r') as f:
                    data = json.load(f)
                    
                    # Convert scanner-specific format to standard format
                    for item in data.get('vulnerabilities', []):
                        finding = {
                            "rule": item.get("rule_id", "unknown"),
                            "title": item.get("title", "Unknown Vulnerability"),
                            "severity": item.get("severity", "info").title(),
                            "description": item.get("description", ""),
                            "url": item.get("url", ""),
                            "scanner": self.name,
                            "scanner_description": "Your New Scanner - Description"
                        }
                        
                        # Map severity to score
                        severity_scores = {"Critical": 9, "High": 7, "Medium": 5, "Low": 3, "Info": 1}
                        finding["score"] = severity_scores.get(finding["severity"], 1)
                        
                        findings.append(finding)
                        
            logger.info(f"📊 YourNewScanner {scan_id}: {len(findings)} findings")
            
        except Exception as e:
            logger.error(f"Error parsing YourNewScanner results for {scan_id}: {e}")
        
        return findings
```

### 2. Add Scanner to MultiScannerManager

In the `MultiScannerManager.__init__()` method, add your scanner with conditional loading:

```python
def __init__(self):
    self.engines = {
        'ventiapi': VentiAPIScanner(),
        'zap': ZAPScanner()
    }
    
    # Add Nuclei scanner if available (conditional)
    try:
        self.engines['nuclei'] = NucleiScanner()
        logger.info("✅ Nuclei scanner enabled")
    except Exception as e:
        logger.warning(f"⚠️ Nuclei scanner disabled: {e}")
    
    # Add your new scanner (conditional)
    try:
        self.engines['yournewscanner'] = YourNewScanner()
        logger.info("✅ YourNewScanner enabled")
    except Exception as e:
        logger.warning(f"⚠️ YourNewScanner disabled: {e}")
```

### 3. Update Scanner Descriptions (Optional)

In `main.py`, add your scanner to the descriptions:

```python
@app.get("/api/scanners")
async def get_available_scanners():
    """Get list of available scanner engines"""
    available = multi_scanner.get_available_engines()
    descriptions = {
        "ventiapi": "VentiAPI - OWASP API Security Top 10 focused scanner",
        "zap": "OWASP ZAP - Comprehensive web application security scanner", 
        "nuclei": "Nuclei - Community-powered vulnerability scanner",
        "yournewscanner": "YourNewScanner - Description of what it does"
    }
    
    return {
        "available_scanners": available,
        "descriptions": {k: v for k, v in descriptions.items() if k in available}
    }
```

### 4. Test Your Integration

Follow these steps to safely test your new scanner:

#### A. Test Locally First
```bash
# Test the scanner class independently
python3 -c "
from scanner_engines import YourNewScanner
scanner = YourNewScanner()
print('Scanner created successfully')
"
```

#### B. Update Container
```bash
# Stop and remove existing container
docker stop ventiapi-web-api || true
docker rm ventiapi-web-api || true
docker rmi scannerapp-web-api || true

# Rebuild with no cache
docker compose build --no-cache web-api

# Start container
docker compose up -d web-api
```

#### C. Verify Integration
```bash
# Check if your scanner appears in the list
curl -s http://localhost:3000/api/scanners | jq .

# Test that login still works
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"MICS295","password":"MaryMcHale"}' | jq .

# Test frontend accessibility
curl -s http://localhost:3000/ | head -n 5
```

## Best Practices

### Security Considerations
- **Resource limits**: Always set `--memory` and `--cpus` limits
- **Security options**: Use `--security-opt no-new-privileges`
- **Network isolation**: Consider using `--network none` if external access isn't needed
- **Volume permissions**: Use `:ro` (read-only) where possible

### Error Handling
- **Conditional loading**: Wrap scanner initialization in try/catch
- **Graceful failures**: Return structured error responses
- **Logging**: Use appropriate log levels (info, warning, error)

### Result Standardization
Always return findings in this format:
```python
{
    "rule": "rule_identifier",
    "title": "Human readable title",
    "severity": "Critical|High|Medium|Low|Info",
    "score": 1-9,  # Numeric severity
    "description": "Detailed description",
    "url": "Affected URL",
    "scanner": "scanner_name",
    "scanner_description": "Scanner description"
}
```

### Docker Image Requirements
Your scanner's Docker image should:
- Accept target URL as a parameter
- Output results to a specified file path
- Exit with appropriate status codes (0 = success)
- Handle timeouts gracefully
- Be lightweight and security-focused

## Common Issues & Solutions

### 1. Import Errors
**Problem**: ModuleNotFoundError when adding scanner
**Solution**: Add scanner class directly to `scanner_engines.py`, don't create separate modules

### 2. Container Build Cache
**Problem**: Changes not reflected in container
**Solution**: Use `--no-cache` flag and remove old images completely

### 3. Volume Permissions
**Problem**: Scanner can't write results
**Solution**: Ensure shared volumes are mounted with `:rw` permissions

### 4. Resource Exhaustion
**Problem**: Scanner containers consuming too many resources
**Solution**: Set appropriate `--memory` and `--cpus` limits

### 5. Network Issues
**Problem**: Scanner can't reach target
**Solution**: Use `--network host` for simplicity, or configure custom networks

## Example: Adding Nikto Scanner

Here's a complete example of adding Nikto web vulnerability scanner:

```python
class NiktoScanner(ScannerEngine):
    """Nikto Web Vulnerability Scanner"""
    
    def __init__(self):
        super().__init__("nikto")
        self.image = "sullo/nikto:latest"
    
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str, 
                          options: Dict[str, Any]) -> List[str]:
        volume_prefix = options.get('volume_prefix', 'scannerapp')
        output_file = f'/tmp/{scan_id}_nikto.json'
        
        cmd = [
            'docker', 'run', '--rm',
            '--network', 'host',
            '--memory', '256m',
            '--cpus', '0.25',
            '--security-opt', 'no-new-privileges',
            '-v', f'{volume_prefix}_shared-results:/tmp:rw',
            f'--name', f'nikto-scanner-{scan_id}',
            f'--label', f'scan_id={scan_id}',
            self.image,
            '-h', target_url,
            '-Format', 'json',
            '-output', output_file
        ]
        
        return cmd
```

## Testing Checklist

Before deploying your new scanner:

- [ ] Scanner class implements all required methods
- [ ] Docker command generates valid arguments
- [ ] Results are parsed into standard format
- [ ] Error handling covers edge cases
- [ ] Resource limits are appropriate
- [ ] Security settings are applied
- [ ] Container rebuilds successfully
- [ ] Scanner appears in `/api/scanners`
- [ ] Login functionality still works
- [ ] Frontend remains accessible
- [ ] Integration doesn't break existing scanners

## Support

If you encounter issues:
1. Check Docker container logs: `docker logs ventiapi-web-api`
2. Verify scanner image exists: `docker images | grep your-scanner`
3. Test scanner independently before integration
4. Use conditional loading to prevent system breakage
5. Follow the patterns established by existing scanners

Remember: **Always test thoroughly and use conditional loading to ensure system stability!**