"""
Nikto Scanner Plugin
Example of adding a new scanner to the VentiAPI scanner system
"""
import os
import subprocess
import json
import asyncio
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import logging
import tempfile

from .base import (
    BaseScanner, ScannerType, ScanTarget, ScanConfig, ScanResult,
    SecurityFinding, SeverityLevel
)


class NiktoDirectScanner(BaseScanner):
    """Direct Nikto scanner integration (runs nikto binary directly)"""
    
    def __init__(self):
        super().__init__(
            name="Nikto Web Scanner",
            scanner_type=ScannerType.NIKTO  # You'll need to add this to the enum
        )
        self.logger = logging.getLogger(__name__)
        self.nikto_path = self._find_nikto_binary()
    
    def _find_nikto_binary(self) -> str:
        """Find nikto binary path"""
        # Check common locations
        paths = [
            "/usr/bin/nikto",
            "/usr/local/bin/nikto", 
            "/opt/nikto/program/nikto.pl",
            "nikto"  # In PATH
        ]
        
        for path in paths:
            try:
                result = subprocess.run([path, "-Version"], 
                                     capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return path
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
        
        raise RuntimeError("Nikto binary not found. Please install nikto.")
    
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if target is supported by Nikto"""
        return target.url.startswith(('http://', 'https://'))
    
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate scan configuration"""
        return config.timeout > 0
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Get scanner capabilities"""
        return {
            "supports_auth": True,
            "supports_custom_headers": False,
            "parallel_scans": True,
            "max_concurrent": 3,
            "scan_types": ["web", "ssl", "cgi"]
        }
    
    def get_scanner_info(self) -> Dict[str, Any]:
        """Get scanner information"""
        try:
            result = subprocess.run([self.nikto_path, "-Version"],
                                  capture_output=True, text=True, timeout=5)
            version = "Unknown"
            if result.returncode == 0:
                # Parse version from output
                lines = result.stdout.split('\n')
                for line in lines:
                    if "Nikto" in line and "v" in line:
                        version = line.strip()
                        break
        except:
            version = "Unknown"
        
        return {
            "name": self.name,
            "type": "nikto",
            "version": version,
            "capabilities": ["web", "ssl", "cgi"],
            "supported_targets": ["http", "https"],
            "description": "Web server scanner for vulnerabilities and misconfigurations",
            "status": "available"
        }
    
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[Callable] = None
    ) -> ScanResult:
        """Perform Nikto scan"""
        start_time = datetime.utcnow()
        
        try:
            self.logger.info(f"Starting Nikto scan for {target.url}")
            
            # Create temp file for JSON output
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                output_file = temp_file.name
            
            # Build nikto command
            cmd = [
                self.nikto_path,
                "-h", target.url,
                "-Format", "json",
                "-output", output_file,
                "-timeout", str(config.timeout),
                "-maxtime", str(config.timeout * 60)  # Convert to seconds
            ]
            
            # Add authentication if provided
            if hasattr(target, 'auth') and target.auth:
                if target.auth.get('username') and target.auth.get('password'):
                    auth_string = f"{target.auth['username']}:{target.auth['password']}"
                    cmd.extend(["-id", auth_string])
            
            # Add SSL options for HTTPS
            if target.url.startswith('https://'):
                cmd.extend(["-ssl"])
            
            # Run nikto asynchronously
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Update progress periodically
            if progress_callback:
                progress_callback(25)
            
            stdout, stderr = await process.communicate()
            
            if progress_callback:
                progress_callback(75)
            
            # Parse results
            findings = await self._parse_nikto_results(output_file)
            
            # Clean up temp file
            try:
                os.unlink(output_file)
            except:
                pass
            
            if progress_callback:
                progress_callback(100)
            
            status = "completed" if process.returncode == 0 else "failed"
            error_message = stderr.decode() if process.returncode != 0 else None
            
            return ScanResult(
                scan_id=scan_id,
                scanner_type=self.scanner_type,
                status=status,
                target=target,
                config=config,
                findings=findings,
                metadata={"nikto_exit_code": process.returncode},
                started_at=start_time,
                completed_at=datetime.utcnow(),
                error_message=error_message
            )
            
        except Exception as e:
            self.logger.error(f"Nikto scan failed: {e}")
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
    
    async def _parse_nikto_results(self, output_file: str) -> List[SecurityFinding]:
        """Parse Nikto JSON output into SecurityFinding objects"""
        findings = []
        
        try:
            if not os.path.exists(output_file):
                return findings
            
            with open(output_file, 'r') as f:
                data = json.load(f)
            
            # Nikto JSON structure may vary, adapt as needed
            if isinstance(data, dict) and 'vulnerabilities' in data:
                vulns = data['vulnerabilities']
            elif isinstance(data, list):
                vulns = data
            else:
                self.logger.warning("Unexpected Nikto output format")
                return findings
            
            for vuln in vulns:
                try:
                    finding = SecurityFinding(
                        id=f"nikto-{vuln.get('id', 'unknown')}",
                        title=vuln.get('msg', 'Nikto Finding'),
                        description=vuln.get('msg', '') + "\n" + vuln.get('uri', ''),
                        severity=self._map_nikto_severity(vuln.get('OSVDB', '0')),
                        category="Web Security",
                        endpoint=vuln.get('uri', ''),
                        method=vuln.get('method', 'GET'),
                        evidence={
                            "response": vuln.get('response', ''),
                            "osvdb": vuln.get('OSVDB', ''),
                            "method": vuln.get('method', '')
                        },
                        references=self._extract_references(vuln)
                    )
                    findings.append(finding)
                except Exception as e:
                    self.logger.error(f"Error parsing Nikto finding: {e}")
                    continue
        
        except Exception as e:
            self.logger.error(f"Error parsing Nikto results: {e}")
        
        return findings
    
    def _map_nikto_severity(self, osvdb: str) -> SeverityLevel:
        """Map OSVDB ID or other indicators to severity levels"""
        # Simple heuristic - in practice you'd want more sophisticated mapping
        if not osvdb or osvdb == "0":
            return SeverityLevel.INFO
        
        osvdb_num = int(osvdb) if osvdb.isdigit() else 0
        
        if osvdb_num > 10000:
            return SeverityLevel.HIGH
        elif osvdb_num > 1000:
            return SeverityLevel.MEDIUM
        else:
            return SeverityLevel.LOW
    
    def _extract_references(self, vuln: Dict) -> List[str]:
        """Extract references from Nikto vulnerability data"""
        refs = []
        
        if vuln.get('OSVDB'):
            refs.append(f"OSVDB-{vuln['OSVDB']}")
        
        if vuln.get('uri'):
            refs.append(vuln['uri'])
        
        return refs
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running scan (would need process tracking in real implementation)"""
        # In a full implementation, you'd track running processes and kill them
        self.logger.info(f"Stop requested for scan {scan_id}")
        return True


# Optional: Microservice version if you prefer that approach
class NiktoMicroserviceScanner(BaseScanner):
    """Nikto scanner via dedicated microservice"""
    
    def __init__(self, service_url: str = None):
        service_url = service_url or os.getenv("NIKTO_SERVICE_URL", "http://localhost:8003")
        super().__init__(
            name="Nikto Scanner (Microservice)",
            scanner_type=ScannerType.NIKTO
        )
        self.service_url = service_url.rstrip('/')
        self.timeout = 30
        self.logger = logging.getLogger(__name__)
    
    # Implement similar to existing microservice scanners...
    async def scan(self, scan_id: str, target: ScanTarget, config: ScanConfig, 
                  progress_callback: Optional[Callable] = None) -> ScanResult:
        # Implementation would be similar to existing microservice scanners
        # Send HTTP requests to nikto microservice
        pass