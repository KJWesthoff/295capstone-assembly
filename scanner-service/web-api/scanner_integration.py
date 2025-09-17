"""
Integration layer between the existing API and the new plugin architecture
This allows gradual migration to the plugin system
"""
import asyncio
import json
from typing import Dict, List, Optional, Any
from pathlib import Path

from scanner_plugins.manager import scanner_manager
from scanner_plugins.base import ScanTarget, ScanConfig, ScannerType


class ScannerIntegration:
    """Bridge between existing API and plugin architecture"""
    
    def __init__(self):
        self.manager = scanner_manager
        self.legacy_scans: Dict[str, Dict] = {}  # Maps scan_id to legacy scan data
    
    async def start_legacy_scan(
        self,
        scan_id: str,
        server_url: str,
        spec_location: Optional[str],
        dangerous: bool,
        user: Dict,
        rps: float = 1.0,
        max_requests: int = 100,
        fuzz_auth: bool = False,
        progress_callback: Optional[callable] = None
    ) -> Dict:
        """
        Start a scan using the new plugin system but maintain legacy interface
        """
        
        # Convert legacy parameters to plugin format
        target = ScanTarget(
            url=server_url,
            spec_file=spec_location,
            target_type="api"
        )
        
        config = ScanConfig(
            max_requests=max_requests,
            requests_per_second=rps,
            timeout=600,
            dangerous_mode=dangerous,
            fuzz_auth=fuzz_auth,
            parallel_chunks=1
        )
        
        # Use VentiAPI scanner (default for now)
        scanner_type = ScannerType.VENTI_API
        
        try:
            # Start scan using plugin manager
            result = await self.manager.start_scan(
                scan_id=scan_id,
                target=target,
                config=config,
                scanner_type=scanner_type,
                user_info=user,
                progress_callback=progress_callback
            )
            
            # Convert plugin result to legacy format
            legacy_result = self._convert_to_legacy_format(result, user)
            
            # Store for legacy compatibility
            self.legacy_scans[scan_id] = legacy_result
            
            return legacy_result
            
        except Exception as e:
            # Return legacy error format
            return {
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e),
                "user": user["username"],
                "server_url": server_url,
                "dangerous": dangerous,
                "progress": 100,
                "current_phase": "Scan failed",
                "findings_count": 0
            }
    
    def _convert_to_legacy_format(self, plugin_result, user: Dict) -> Dict:
        """Convert plugin ScanResult to legacy format"""
        return {
            "scan_id": plugin_result.scan_id,
            "status": plugin_result.status,
            "progress": 100 if plugin_result.status in ["completed", "failed"] else 0,
            "current_phase": "Scan completed" if plugin_result.status == "completed" else "Processing",
            "user": user["username"],
            "server_url": plugin_result.target.url,
            "target_url": plugin_result.target.url,
            "spec_location": plugin_result.target.spec_file,
            "dangerous": plugin_result.config.dangerous_mode,
            "created_at": plugin_result.started_at.isoformat(),
            "completed_at": plugin_result.completed_at.isoformat() if plugin_result.completed_at else None,
            "findings_count": len(plugin_result.findings),
            "scanner_type": plugin_result.scanner_type.value,
            "error": plugin_result.error_message,
            "metadata": plugin_result.metadata,
            # Legacy compatibility fields
            "parallel_mode": False,
            "total_chunks": 1,
            "completed_chunks": 1 if plugin_result.status == "completed" else 0,
            "chunk_status": []
        }
    
    async def get_legacy_scan_status(self, scan_id: str) -> Optional[Dict]:
        """Get scan status in legacy format"""
        if scan_id in self.legacy_scans:
            return self.legacy_scans[scan_id]
        
        # Check with plugin manager
        plugin_status = self.manager.get_scan_status(scan_id)
        if plugin_status and "result" in plugin_status:
            result = plugin_status["result"]
            user = plugin_status.get("user", {})
            return self._convert_to_legacy_format(result, user)
        
        return None
    
    async def get_legacy_findings(self, scan_id: str) -> List[Dict]:
        """Get findings in legacy format"""
        # Check if we have the scan in legacy format
        if scan_id in self.legacy_scans:
            scan_data = self.legacy_scans[scan_id]
            
            # Try to load findings from file (legacy way)
            shared_results = Path("/shared/results")
            findings_file = shared_results / scan_id / "findings.json"
            
            if findings_file.exists():
                try:
                    with open(findings_file) as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Error loading legacy findings: {e}")
                    return []
        
        # Check with plugin manager
        plugin_status = self.manager.get_scan_status(scan_id)
        if plugin_status and "result" in plugin_status:
            result = plugin_status["result"]
            # Convert plugin findings to legacy format
            return [self._convert_finding_to_legacy(f) for f in result.findings]
        
        return []
    
    def _convert_finding_to_legacy(self, finding) -> Dict:
        """Convert plugin SecurityFinding to legacy format"""
        return {
            "id": finding.id,
            "title": finding.title,
            "description": finding.description,
            "severity": finding.severity.value.upper(),
            "category": finding.category,
            "endpoint": finding.endpoint,
            "method": finding.method,
            "evidence": finding.evidence,
            "remediation": finding.remediation,
            "references": finding.references,
            "cvss_score": finding.cvss_score,
            "cwe_id": finding.cwe_id
        }
    
    async def stop_legacy_scan(self, scan_id: str) -> bool:
        """Stop a scan using plugin manager"""
        success = await self.manager.stop_scan(scan_id)
        
        if success and scan_id in self.legacy_scans:
            self.legacy_scans[scan_id]["status"] = "stopped"
            self.legacy_scans[scan_id]["progress"] = 100
            self.legacy_scans[scan_id]["current_phase"] = "Scan stopped"
        
        return success
    
    def get_available_scanners_info(self) -> List[Dict]:
        """Get information about available scanners"""
        return self.manager.get_available_scanners()
    
    async def health_check_scanners(self) -> Dict[str, bool]:
        """Check health of all scanners"""
        return await self.manager.health_check_all()
    
    def get_legacy_scan_list(self, user: Optional[str] = None) -> List[Dict]:
        """Get list of scans in legacy format"""
        scans = []
        
        # Add legacy scans
        for scan_id, scan_data in self.legacy_scans.items():
            if user and scan_data.get("user") != user:
                continue
            scans.append(scan_data)
        
        # Add active scans from plugin manager
        active_scans = self.manager.get_active_scans(user)
        for active_scan in active_scans:
            # Convert to legacy format if not already in legacy_scans
            scan_id = active_scan["scan_id"]
            if scan_id not in self.legacy_scans:
                plugin_status = self.manager.get_scan_status(scan_id)
                if plugin_status and "result" in plugin_status:
                    result = plugin_status["result"]
                    user_info = plugin_status.get("user", {})
                    legacy_format = self._convert_to_legacy_format(result, user_info)
                    scans.append(legacy_format)
        
        return scans


# Global integration instance
scanner_integration = ScannerIntegration()