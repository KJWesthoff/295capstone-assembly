"""
OWASP ZAP Scanner Plugin (Example Implementation)
This demonstrates how to add additional scanners to the plugin architecture
"""
import asyncio
import json
import os
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .base import (
    BaseScanner, ScannerType, ScannerCapability, ScanTarget, ScanConfig,
    ScanResult, SecurityFinding, SeverityLevel
)


class OWASPZAPScanner(BaseScanner):
    """OWASP ZAP Security Scanner Plugin"""
    
    def __init__(self):
        super().__init__(ScannerType.OWASP_ZAP, "OWASP ZAP Scanner")
        self.shared_results = Path("/shared/results")
        self.zap_path = "/opt/zaproxy/zap.sh"  # Default ZAP installation path
        
    def get_capabilities(self) -> ScannerCapability:
        """Return OWASP ZAP scanner capabilities"""
        return ScannerCapability(
            name="OWASP ZAP Scanner",
            description="Web application security scanner with comprehensive vulnerability detection",
            supported_targets=["web", "api"],
            supported_formats=["openapi", "swagger", "url"],
            parallel_capable=False,  # ZAP typically runs single-threaded
            auth_capable=True,
            custom_headers=True
        )
    
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if ZAP can scan this target"""
        # Check if URL is valid
        if not target.url or not target.url.startswith(('http://', 'https://')):
            return False
        
        # ZAP can handle both web and API targets
        return target.target_type in ["web", "api"]
    
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate scan configuration for ZAP"""
        # ZAP has different limits than VentiAPI
        if config.max_requests > 1000 or config.max_requests < 1:
            return False
        if config.requests_per_second > 5.0 or config.requests_per_second < 0.1:
            return False
        if config.timeout > 7200 or config.timeout < 300:  # ZAP can take longer
            return False
        
        return True
    
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[callable] = None
    ) -> ScanResult:
        """Execute OWASP ZAP scan"""
        
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
                await progress_callback(scan_id, 5, "Initializing OWASP ZAP scanner")
            
            # Prepare scan directories
            result_dir = self.shared_results / scan_id
            result_dir.mkdir(parents=True, exist_ok=True, mode=0o755)
            
            # Check if ZAP is available
            if not await self.health_check():
                raise RuntimeError("OWASP ZAP is not available")
            
            if progress_callback:
                await progress_callback(scan_id, 10, "Starting ZAP daemon")
            
            # Build ZAP command
            cmd = self._build_zap_command(scan_id, target, config)
            
            if progress_callback:
                await progress_callback(scan_id, 15, "Starting security scan with ZAP")
            
            # Execute scan
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Monitor progress
            if progress_callback:
                progress_task = asyncio.create_task(
                    self._monitor_zap_progress(scan_id, progress_callback)
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
                result.findings = await self._load_zap_findings(scan_id)
                result.metadata = {
                    "total_findings": len(result.findings),
                    "duration_seconds": (result.completed_at - start_time).total_seconds(),
                    "scanner_version": "2.14.0",  # Example ZAP version
                    "scan_type": "active"
                }
                
                if progress_callback:
                    await progress_callback(scan_id, 100, "ZAP scan completed successfully")
                
            else:
                # Scan failed
                result.status = "failed"
                result.error_message = stderr.decode()[:500] if stderr else "Unknown ZAP error"
                result.completed_at = datetime.utcnow()
                
                if progress_callback:
                    await progress_callback(scan_id, 100, f"ZAP scan failed: {result.error_message}")
            
        except asyncio.TimeoutError:
            result.status = "failed"
            result.error_message = f"ZAP scan timed out after {config.timeout} seconds"
            result.completed_at = datetime.utcnow()
            
            if progress_callback:
                await progress_callback(scan_id, 100, "ZAP scan timed out")
            
        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()
            
            if progress_callback:
                await progress_callback(scan_id, 100, f"ZAP scan error: {str(e)}")
        
        return result
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running ZAP scan"""
        try:
            # ZAP typically requires API calls to stop scans
            # This is a simplified implementation
            subprocess.run([
                'pkill', '-f', f'zap.*{scan_id}'
            ], capture_output=True)
            
            return True
        except Exception as e:
            print(f"Error stopping ZAP scan {scan_id}: {e}")
            return False
    
    def _build_zap_command(self, scan_id: str, target: ScanTarget, config: ScanConfig) -> List[str]:
        """Build ZAP command line"""
        output_file = self.shared_results / scan_id / "zap_report.json"
        
        cmd = [
            self.zap_path,
            '-cmd',  # Command line mode
            '-quickurl', target.url,
            '-quickout', str(output_file),
            '-quickprogress'
        ]
        
        # Add configuration options
        if config.dangerous_mode:
            cmd.extend(['-quickautostart'])  # More aggressive scanning
        
        # Add authentication if specified
        if target.authentication:
            # This would need to be implemented based on ZAP's auth options
            pass
        
        return cmd
    
    async def _monitor_zap_progress(self, scan_id: str, progress_callback: callable):
        """Monitor ZAP scan progress"""
        progress_steps = [
            (20, "ZAP starting spider scan"),
            (35, "ZAP discovering endpoints"),
            (50, "ZAP running active scan"),
            (65, "ZAP testing for vulnerabilities"),
            (80, "ZAP analyzing results"),
            (95, "ZAP generating report")
        ]
        
        for progress, phase in progress_steps:
            await asyncio.sleep(20)  # ZAP typically takes longer
            await progress_callback(scan_id, progress, phase)
    
    async def _load_zap_findings(self, scan_id: str) -> List[SecurityFinding]:
        """Load and normalize ZAP findings"""
        zap_report = self.shared_results / scan_id / "zap_report.json"
        
        if not zap_report.exists():
            return []
        
        try:
            with open(zap_report) as f:
                zap_data = json.load(f)
            
            # ZAP has a different report format
            raw_findings = zap_data.get("site", [{}])[0].get("alerts", [])
            return self.normalize_findings(raw_findings)
        except Exception as e:
            print(f"Error loading ZAP findings for {scan_id}: {e}")
            return []
    
    def _normalize_single_finding(self, raw_finding: Dict) -> Optional[SecurityFinding]:
        """Convert ZAP finding to standard format"""
        try:
            # Map ZAP risk levels to standard severity
            risk_map = {
                "High": SeverityLevel.HIGH,
                "Medium": SeverityLevel.MEDIUM,
                "Low": SeverityLevel.LOW,
                "Informational": SeverityLevel.INFO
            }
            
            severity = risk_map.get(
                raw_finding.get("riskdesc", "").split()[0],  # ZAP format: "High (Medium)"
                SeverityLevel.MEDIUM
            )
            
            # Extract instance information (ZAP can have multiple instances per alert)
            instances = raw_finding.get("instances", [])
            endpoint = instances[0].get("uri", "") if instances else raw_finding.get("url", "")
            method = instances[0].get("method", "GET") if instances else "GET"
            
            return SecurityFinding(
                id=f"zap-{raw_finding.get('pluginid', str(uuid.uuid4()))}",
                title=raw_finding.get("name", "Unknown ZAP Finding"),
                description=raw_finding.get("desc", ""),
                severity=severity,
                category=self._map_zap_category(raw_finding.get("name", "")),
                endpoint=endpoint,
                method=method,
                evidence={
                    "attack": instances[0].get("attack", "") if instances else "",
                    "evidence": instances[0].get("evidence", "") if instances else "",
                    "param": instances[0].get("param", "") if instances else ""
                },
                remediation=raw_finding.get("solution", ""),
                references=[raw_finding.get("reference", "")] if raw_finding.get("reference") else [],
                cvss_score=None,  # ZAP doesn't always provide CVSS
                cwe_id=raw_finding.get("cweid")
            )
        except Exception as e:
            print(f"Error normalizing ZAP finding: {e}")
            return None
    
    def _map_zap_category(self, finding_name: str) -> str:
        """Map ZAP finding names to categories"""
        name_lower = finding_name.lower()
        
        if "injection" in name_lower or "sql" in name_lower:
            return "injection"
        elif "xss" in name_lower or "script" in name_lower:
            return "xss"
        elif "auth" in name_lower or "session" in name_lower:
            return "auth"
        elif "crypto" in name_lower or "ssl" in name_lower or "tls" in name_lower:
            return "crypto"
        elif "disclosure" in name_lower or "exposure" in name_lower:
            return "disclosure"
        else:
            return "other"
    
    async def health_check(self) -> bool:
        """Check if OWASP ZAP is available"""
        try:
            # Check if ZAP executable exists
            if not Path(self.zap_path).exists():
                return False
            
            # Try to run ZAP version check
            result = subprocess.run([
                self.zap_path, '-version'
            ], capture_output=True, text=True, timeout=10)
            
            return result.returncode == 0
            
        except Exception:
            return False
    
    def get_default_config(self) -> ScanConfig:
        """Get default configuration for ZAP"""
        return ScanConfig(
            max_requests=200,
            requests_per_second=2.0,
            timeout=1800,  # ZAP typically needs more time
            dangerous_mode=False,
            fuzz_auth=True,
            parallel_chunks=1
        )