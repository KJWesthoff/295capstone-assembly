"""
VentiAPI Scanner Plugin
Wrapper for the existing VentiAPI scanner functionality
"""
import asyncio
import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .base import (
    BaseScanner, ScannerType, ScannerCapability, ScanTarget, ScanConfig,
    ScanResult, SecurityFinding, SeverityLevel
)


class VentiAPIScanner(BaseScanner):
    """VentiAPI Security Scanner Plugin"""
    
    def __init__(self):
        super().__init__(ScannerType.VENTI_API, "VentiAPI Scanner")
        self.shared_results = Path("/shared/results")
        self.shared_specs = Path("/shared/specs")
        
    def get_capabilities(self) -> ScannerCapability:
        """Return VentiAPI scanner capabilities"""
        return ScannerCapability(
            name="VentiAPI Scanner",
            description="Comprehensive API security scanner with OpenAPI support",
            supported_targets=["api"],
            supported_formats=["openapi", "swagger"],
            parallel_capable=True,
            auth_capable=True,
            custom_headers=True
        )
    
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if VentiAPI can scan this target"""
        # Check if URL is valid
        if not target.url or not target.url.startswith(('http://', 'https://')):
            return False
        
        # VentiAPI works best with API targets
        return target.target_type == "api"
    
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate scan configuration"""
        # Check limits
        if config.max_requests > 500 or config.max_requests < 1:
            return False
        if config.requests_per_second > 10.0 or config.requests_per_second < 0.1:
            return False
        if config.timeout > 3600 or config.timeout < 60:
            return False
        
        return True
    
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[callable] = None
    ) -> ScanResult:
        """Execute VentiAPI scan"""
        
        start_time = datetime.utcnow()
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
        
        try:
            # Update progress
            if progress_callback:
                await progress_callback(scan_id, 10, "Initializing VentiAPI scanner")
            
            # Prepare scan directories
            result_dir = self.shared_results / scan_id
            result_dir.mkdir(parents=True, exist_ok=True, mode=0o755)
            
            # Check if Docker is available
            docker_available = shutil.which('docker') is not None
            
            if docker_available:
                # Use Docker execution
                cmd = self._get_docker_command(scan_id, target, config)
            else:
                # Use direct execution (Railway compatible)
                cmd = self._get_railway_command(scan_id, target, config)
            
            if progress_callback:
                await progress_callback(scan_id, 20, "Starting security scan")
            
            # Execute scan
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/app/scanner" if not docker_available else None,
                env={**os.environ, "PYTHONPATH": "/app/scanner"} if not docker_available else None
            )
            
            # Monitor progress
            if progress_callback:
                progress_task = asyncio.create_task(
                    self._monitor_scan_progress(scan_id, progress_callback)
                )
            
            # Wait for completion
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=config.timeout
            )
            
            if progress_callback:
                progress_task.cancel()
            
            if process.returncode == 0:
                # Scan completed successfully
                result.status = "completed"
                result.completed_at = datetime.utcnow()
                
                # Load findings
                result.findings = await self._load_findings(scan_id)
                result.metadata = {
                    "total_findings": len(result.findings),
                    "duration_seconds": (result.completed_at - start_time).total_seconds(),
                    "scanner_version": "2.0.0",
                    "docker_mode": docker_available
                }
                
                if progress_callback:
                    await progress_callback(scan_id, 100, "Scan completed successfully")
                
            else:
                # Scan failed
                result.status = "failed"
                result.error_message = stderr.decode()[:500] if stderr else "Unknown error"
                result.completed_at = datetime.utcnow()
                
                if progress_callback:
                    await progress_callback(scan_id, 100, f"Scan failed: {result.error_message}")
            
        except asyncio.TimeoutError:
            result.status = "failed"
            result.error_message = f"Scan timed out after {config.timeout} seconds"
            result.completed_at = datetime.utcnow()
            
            if progress_callback:
                await progress_callback(scan_id, 100, "Scan timed out")
            
        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()
            
            if progress_callback:
                await progress_callback(scan_id, 100, f"Scan error: {str(e)}")
        
        return result
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running VentiAPI scan"""
        try:
            # Kill any running containers for this scan
            if shutil.which('docker'):
                subprocess.run([
                    'docker', 'kill', f'ventiapi-scanner-{scan_id}'
                ], capture_output=True)
            
            return True
        except Exception as e:
            print(f"Error stopping scan {scan_id}: {e}")
            return False
    
    def _get_docker_command(self, scan_id: str, target: ScanTarget, config: ScanConfig) -> List[str]:
        """Build Docker command for VentiAPI scanner"""
        cmd = [
            'docker', 'run', '--rm',
            '--name', f'ventiapi-scanner-{scan_id}',
            '--network', 'host',
            '--memory', '512m',
            '--cpus', '0.5',
            '-v', f'{self.shared_results}:/shared/results',
            '-v', f'{self.shared_specs}:/shared/specs',
            'ventiapi-scanner/scanner:latest',
            '--server', target.url,
            '--out', f'/shared/results/{scan_id}',
            '--rps', str(config.requests_per_second),
            '--max-requests', str(config.max_requests)
        ]
        
        if target.spec_file:
            cmd.extend(['--spec', target.spec_file])
        else:
            cmd.extend(['--spec', f'{target.url}/openapi.json'])
        
        if config.dangerous_mode:
            cmd.append('--dangerous')
        
        if config.fuzz_auth:
            cmd.append('--fuzz-auth')
        
        return cmd
    
    def _get_railway_command(self, scan_id: str, target: ScanTarget, config: ScanConfig) -> List[str]:
        """Build Railway-compatible command for VentiAPI scanner"""
        cmd = [
            'python', '-m', 'scanner.cli',
            '--server', target.url,
            '--out', f'/shared/results/{scan_id}',
            '--rps', str(config.requests_per_second),
            '--max-requests', str(config.max_requests)
        ]
        
        if target.spec_file:
            cmd.extend(['--spec', target.spec_file])
        else:
            cmd.extend(['--spec', f'{target.url}/openapi.json'])
        
        if config.dangerous_mode:
            cmd.append('--dangerous')
        
        if config.fuzz_auth:
            cmd.append('--fuzz-auth')
        
        return cmd
    
    async def _monitor_scan_progress(self, scan_id: str, progress_callback: callable):
        """Monitor VentiAPI scan progress"""
        progress_steps = [
            (30, "Testing authentication"),
            (45, "Scanning for injection vulnerabilities"),
            (60, "Checking authorization controls"),
            (75, "Testing input validation"),
            (85, "Analyzing response patterns"),
            (95, "Finalizing analysis")
        ]
        
        for progress, phase in progress_steps:
            await asyncio.sleep(15)  # Update every 15 seconds
            await progress_callback(scan_id, progress, phase)
    
    async def _load_findings(self, scan_id: str) -> List[SecurityFinding]:
        """Load and normalize VentiAPI findings"""
        findings_file = self.shared_results / scan_id / "findings.json"
        
        if not findings_file.exists():
            return []
        
        try:
            with open(findings_file) as f:
                raw_findings = json.load(f)
            
            return self.normalize_findings(raw_findings)
        except Exception as e:
            print(f"Error loading findings for {scan_id}: {e}")
            return []
    
    def _normalize_single_finding(self, raw_finding: Dict) -> Optional[SecurityFinding]:
        """Convert VentiAPI finding to standard format"""
        try:
            # Map VentiAPI severity to standard levels
            severity_map = {
                "CRITICAL": SeverityLevel.CRITICAL,
                "HIGH": SeverityLevel.HIGH,
                "MEDIUM": SeverityLevel.MEDIUM,
                "LOW": SeverityLevel.LOW,
                "INFO": SeverityLevel.INFO
            }
            
            severity = severity_map.get(
                raw_finding.get("severity", "").upper(),
                SeverityLevel.MEDIUM
            )
            
            return SecurityFinding(
                id=raw_finding.get("id", str(uuid.uuid4())),
                title=raw_finding.get("title", "Unknown Finding"),
                description=raw_finding.get("description", ""),
                severity=severity,
                category=raw_finding.get("category", "unknown"),
                endpoint=raw_finding.get("endpoint", ""),
                method=raw_finding.get("method", "GET"),
                evidence=raw_finding.get("evidence"),
                remediation=raw_finding.get("remediation"),
                references=raw_finding.get("references"),
                cvss_score=raw_finding.get("cvss_score"),
                cwe_id=raw_finding.get("cwe_id")
            )
        except Exception as e:
            print(f"Error normalizing VentiAPI finding: {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check if VentiAPI scanner is available"""
        try:
            # Check if Docker is available or if we can run directly
            if shutil.which('docker'):
                # Check if scanner image exists
                result = subprocess.run([
                    'docker', 'images', 'ventiapi-scanner/scanner:latest', '--format', '{{.Repository}}'
                ], capture_output=True, text=True)
                return 'ventiapi-scanner/scanner' in result.stdout
            else:
                # Check if we can run the scanner module directly
                return Path("/app/scanner").exists()
        except Exception:
            return False