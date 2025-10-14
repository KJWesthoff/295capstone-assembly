"""
Microservice Scanner Plugin
Communicates with dedicated scanner microservices via HTTP
"""
import httpx
import asyncio
import json
import os
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import logging

from .base import (
    BaseScanner, ScannerType, ScanTarget, ScanConfig, ScanResult,
    SecurityFinding, SeverityLevel
)


class MicroserviceScanner(BaseScanner):
    """Base class for microservice-based scanners"""
    
    def __init__(self, name: str, scanner_type: ScannerType, service_url: str):
        super().__init__(name, scanner_type)
        self.service_url = service_url.rstrip('/')
        self.timeout = 30
        self.logger = logging.getLogger(__name__)
    
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if target is supported"""
        return target.url.startswith(('http://', 'https://'))
    
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate scan configuration"""
        return True
    
    def get_capabilities(self):
        """Get scanner capabilities"""
        return {
            "supports_auth": False,
            "supports_custom_headers": True,
            "parallel_scans": True,
            "max_concurrent": 5
        }
    
    def _normalize_single_finding(self, finding_data: Dict) -> Optional[SecurityFinding]:
        """Normalize a single finding from microservice format"""
        try:
            return SecurityFinding(
                id=finding_data.get("id", ""),
                title=finding_data.get("title", ""),
                description=finding_data.get("description", ""),
                severity=self._map_severity(finding_data.get("severity", "medium")),
                category=finding_data.get("category", ""),
                endpoint=finding_data.get("endpoint", ""),
                method=finding_data.get("method", "GET"),
                evidence=finding_data.get("evidence", {}),
                references=finding_data.get("references", [])
            )
        except Exception as e:
            self.logger.error(f"Error normalizing finding: {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check if the microservice is healthy"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.service_url}/health")
                return response.status_code == 200
        except Exception as e:
            self.logger.error(f"Health check failed for {self.name}: {e}")
            return False
    
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[Callable] = None
    ) -> ScanResult:
        """Start a scan via microservice"""
        try:
            # Start scan
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                scan_request = self._create_scan_request(target, config)
                response = await client.post(
                    f"{self.service_url}/scan/start",
                    json=scan_request
                )
                response.raise_for_status()
                result = response.json()
                service_scan_id = result["scan_id"]
            
            # Poll for completion
            findings = await self._poll_for_completion(service_scan_id, progress_callback)
            
            return ScanResult(
                scan_id=scan_id,
                scanner_type=self.scanner_type,
                status="completed",
                target=target,
                config=config,
                findings=findings,
                metadata={"service_scan_id": service_scan_id},
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            
        except Exception as e:
            self.logger.error(f"Scan failed for {self.name}: {e}")
            return ScanResult(
                scan_id=scan_id,
                scanner_type=self.scanner_type,
                status="failed",
                target=target,
                config=config,
                findings=[],
                metadata={},
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
                error_message=str(e)
            )
    
    async def _poll_for_completion(
        self,
        service_scan_id: str,
        progress_callback: Optional[Callable] = None
    ) -> List[SecurityFinding]:
        """Poll the microservice until scan completion"""
        max_attempts = 300  # 5 minutes with 1 second intervals
        attempt = 0
        
        while attempt < max_attempts:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    # Check status
                    status_response = await client.get(
                        f"{self.service_url}/scan/{service_scan_id}/status"
                    )
                    status_response.raise_for_status()
                    status = status_response.json()
                    
                    # Update progress
                    if progress_callback:
                        progress_callback(status.get("progress", 0))
                    
                    # Check if completed
                    if status["status"] == "completed":
                        # Get findings
                        findings_response = await client.get(
                            f"{self.service_url}/scan/{service_scan_id}/findings"
                        )
                        findings_response.raise_for_status()
                        findings_data = findings_response.json()
                        
                        return self._convert_findings(findings_data["findings"])
                    
                    elif status["status"] == "failed":
                        raise Exception(f"Scan failed: {status.get('error_message', 'Unknown error')}")
                    
                    # Wait before next poll
                    await asyncio.sleep(1)
                    attempt += 1
                    
            except httpx.RequestError as e:
                self.logger.error(f"Request error while polling: {e}")
                await asyncio.sleep(1)
                attempt += 1
        
        raise Exception("Scan timed out")
    
    def _create_scan_request(self, target: ScanTarget, config: ScanConfig) -> Dict:
        """Create scan request for the microservice (override in subclasses)"""
        return {
            "target_url": target.url,
            "timeout": config.timeout
        }
    
    def _convert_findings(self, findings: List[Dict]) -> List[SecurityFinding]:
        """Convert microservice findings to SecurityFinding objects"""
        converted = []
        for finding in findings:
            try:
                converted.append(SecurityFinding(
                    id=finding.get("id", ""),
                    title=finding.get("title", ""),
                    description=finding.get("description", ""),
                    severity=self._map_severity(finding.get("severity", "medium")),
                    category=finding.get("category", ""),
                    endpoint=finding.get("endpoint", ""),
                    method=finding.get("method", "GET"),
                    evidence=finding.get("evidence", {}),
                    references=finding.get("references", [])
                ))
            except Exception as e:
                self.logger.error(f"Error converting finding: {e}")
        
        return converted
    
    def _map_severity(self, severity: str) -> SeverityLevel:
        """Map string severity to SeverityLevel enum"""
        severity_map = {
            "critical": SeverityLevel.CRITICAL,
            "high": SeverityLevel.HIGH,
            "medium": SeverityLevel.MEDIUM,
            "low": SeverityLevel.LOW,
            "info": SeverityLevel.INFO,
            "informational": SeverityLevel.INFO
        }
        return severity_map.get(severity.lower(), SeverityLevel.MEDIUM)
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running scan"""
        # Implementation would need to track service scan IDs
        return True


class NucleiMicroserviceScanner(MicroserviceScanner):
    """Nuclei scanner via microservice"""
    
    def __init__(self, service_url: str = None):
        service_url = service_url or os.getenv("NUCLEI_SERVICE_URL", "http://localhost:8001")
        super().__init__(
            name="Nuclei Scanner (Microservice)",
            scanner_type=ScannerType.NUCLEI,
            service_url=service_url
        )
    
    def _create_scan_request(self, target: ScanTarget, config: ScanConfig) -> Dict:
        return {
            "target_url": target.url,
            "templates": ["cves", "vulnerabilities", "exposures"],
            "severity": ["low", "medium", "high", "critical"],
            "rate_limit": 5,
            "timeout": config.timeout,
            "update_templates": False
        }
    
    def get_scanner_info(self) -> Dict[str, Any]:
        scanner_type_str = self.scanner_type.value if hasattr(self.scanner_type, 'value') else str(self.scanner_type)
        return {
            "name": self.name,
            "type": scanner_type_str,
            "version": "3.4.10",
            "capabilities": ["web", "api", "network"],
            "supported_targets": ["http", "https"],
            "description": "Fast vulnerability scanner with 10,000+ templates",
            "status": "available"
        }


class ZAPMicroserviceScanner(MicroserviceScanner):
    """OWASP ZAP scanner via microservice"""
    
    def __init__(self, service_url: str = None):
        service_url = service_url or os.getenv("ZAP_SERVICE_URL", "http://localhost:8002")
        super().__init__(
            name="OWASP ZAP Scanner (Microservice)",
            scanner_type=ScannerType.ZAP,
            service_url=service_url
        )
    
    def _create_scan_request(self, target: ScanTarget, config: ScanConfig) -> Dict:
        scan_type = "baseline"
        if target.target_type == "api" and target.metadata and target.metadata.get("openapi_spec"):
            scan_type = "api"
        
        request = {
            "target_url": target.url,
            "scan_type": scan_type,
            "timeout": config.timeout,
            "aggressive": config.intensive_scan
        }
        
        # Add OpenAPI spec if available
        if scan_type == "api" and target.metadata and target.metadata.get("openapi_spec"):
            request["openapi_spec_url"] = target.metadata["openapi_spec"]
        
        return request
    
    def get_scanner_info(self) -> Dict[str, Any]:
        scanner_type_str = self.scanner_type.value if hasattr(self.scanner_type, 'value') else str(self.scanner_type)
        return {
            "name": self.name,
            "type": scanner_type_str,
            "version": "2.14.0",
            "capabilities": ["web", "api"],
            "supported_targets": ["http", "https"],
            "description": "Comprehensive web application security scanner",
            "status": "available"
        }