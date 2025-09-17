"""
Scanner Plugin Manager
Coordinates multiple security scanners and provides unified interface
"""
import asyncio
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import logging

from .base import (
    BaseScanner, ScannerType, ScanTarget, ScanConfig, ScanResult,
    SecurityFinding, SeverityLevel
)
import shutil
from .venti_scanner import VentiAPIScanner

# Check environment capabilities
DOCKER_AVAILABLE = shutil.which('docker') is not None


class ScannerManager:
    """Manages multiple security scanner plugins"""
    
    def __init__(self):
        self.scanners: Dict[ScannerType, BaseScanner] = {}
        self.active_scans: Dict[str, Dict] = {}
        self.logger = logging.getLogger(__name__)
        
        # Register available scanners
        self._register_scanners()
    
    def _register_scanners(self):
        """Register all available scanner plugins"""
        try:
            # Register VentiAPI scanner (works in both Docker and Railway)
            venti_scanner = VentiAPIScanner()
            self.scanners[ScannerType.VENTI_API] = venti_scanner
            self.logger.info(f"Registered scanner: {venti_scanner.name}")
            
            # Register containerized scanners only if Docker is available
            if DOCKER_AVAILABLE:
                self.logger.info("Docker available - enabling containerized scanners")
                try:
                    from .container_manager import container_manager
                    
                    # Add containerized scanners to the main manager
                    containerized_scanners = container_manager.get_all_scanners()
                    for name, scanner in containerized_scanners.items():
                        # Map to appropriate scanner type or use CUSTOM
                        scanner_type = scanner.scanner_type
                        if scanner_type not in self.scanners:
                            self.scanners[scanner_type] = scanner
                            self.logger.info(f"Registered containerized scanner: {scanner.name}")
                
                except ImportError as e:
                    self.logger.warning(f"Container manager not available: {e}")
                except Exception as e:
                    self.logger.warning(f"Error loading containerized scanners: {e}")
            else:
                self.logger.info("Docker not available - containerized scanners disabled (Railway mode)")
            
        except Exception as e:
            self.logger.error(f"Error registering scanners: {e}")
    
    def get_available_scanners(self) -> List[Dict[str, Any]]:
        """Get list of available scanners and their capabilities"""
        scanner_info = []
        for scanner_type, scanner in self.scanners.items():
            try:
                info = scanner.get_scanner_info()
                scanner_info.append(info)
            except Exception as e:
                self.logger.error(f"Error getting info for {scanner_type}: {e}")
        
        return scanner_info
    
    def get_scanner(self, scanner_type: ScannerType) -> Optional[BaseScanner]:
        """Get a specific scanner by type"""
        return self.scanners.get(scanner_type)
    
    def get_recommended_scanner(self, target: ScanTarget) -> Optional[BaseScanner]:
        """Get the best scanner for a given target"""
        # For now, default to VentiAPI for API targets
        if target.target_type == "api" and ScannerType.VENTI_API in self.scanners:
            return self.scanners[ScannerType.VENTI_API]
        
        # Return first available scanner as fallback
        if self.scanners:
            return next(iter(self.scanners.values()))
        
        return None
    
    async def start_scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        scanner_type: Optional[ScannerType] = None,
        user_info: Optional[Dict] = None,
        progress_callback: Optional[Callable] = None
    ) -> ScanResult:
        """
        Start a security scan using specified or recommended scanner
        
        Args:
            scan_id: Unique scan identifier
            target: Target to scan
            config: Scan configuration
            scanner_type: Specific scanner to use (optional)
            user_info: User information for logging
            progress_callback: Progress update callback
            
        Returns:
            ScanResult object
        """
        
        # Get scanner
        if scanner_type:
            scanner = self.get_scanner(scanner_type)
            if not scanner:
                raise ValueError(f"Scanner {scanner_type.value} not available")
        else:
            scanner = self.get_recommended_scanner(target)
            if not scanner:
                raise ValueError("No suitable scanner available")
        
        # Validate target and config
        if not scanner.validate_target(target):
            raise ValueError(f"Target not supported by {scanner.name}")
        
        if not scanner.validate_config(config):
            raise ValueError(f"Invalid configuration for {scanner.name}")
        
        # Check scanner health
        if not await scanner.health_check():
            raise RuntimeError(f"Scanner {scanner.name} health check failed")
        
        # Track active scan
        self.active_scans[scan_id] = {
            "scanner": scanner,
            "target": target,
            "config": config,
            "user": user_info,
            "started_at": datetime.utcnow(),
            "status": "starting"
        }
        
        try:
            # Start the scan
            self.logger.info(f"Starting scan {scan_id} with {scanner.name}")
            result = await scanner.scan(scan_id, target, config, progress_callback)
            
            # Update tracking
            self.active_scans[scan_id]["status"] = result.status
            self.active_scans[scan_id]["result"] = result
            
            self.logger.info(f"Scan {scan_id} completed with status: {result.status}")
            return result
            
        except Exception as e:
            # Handle scan errors
            self.logger.error(f"Scan {scan_id} failed: {e}")
            self.active_scans[scan_id]["status"] = "failed"
            self.active_scans[scan_id]["error"] = str(e)
            
            # Return failed result
            return ScanResult(
                scan_id=scan_id,
                scanner_type=scanner.scanner_type,
                status="failed",
                target=target,
                config=config,
                findings=[],
                metadata={"error": str(e)},
                started_at=self.active_scans[scan_id]["started_at"],
                completed_at=datetime.utcnow(),
                error_message=str(e)
            )
        
        finally:
            # Clean up tracking after some time
            pass  # Could implement cleanup task
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop an active scan"""
        if scan_id not in self.active_scans:
            return False
        
        scan_info = self.active_scans[scan_id]
        scanner = scan_info["scanner"]
        
        try:
            success = await scanner.stop_scan(scan_id)
            if success:
                self.active_scans[scan_id]["status"] = "stopped"
                self.logger.info(f"Stopped scan {scan_id}")
            return success
        except Exception as e:
            self.logger.error(f"Error stopping scan {scan_id}: {e}")
            return False
    
    def get_scan_status(self, scan_id: str) -> Optional[Dict]:
        """Get status of an active scan"""
        return self.active_scans.get(scan_id)
    
    def get_active_scans(self, user: Optional[str] = None) -> List[Dict]:
        """Get list of active scans, optionally filtered by user"""
        scans = []
        for scan_id, scan_info in self.active_scans.items():
            if user and scan_info.get("user", {}).get("username") != user:
                continue
            
            scans.append({
                "scan_id": scan_id,
                "scanner": scan_info["scanner"].name,
                "target": scan_info["target"].url,
                "status": scan_info["status"],
                "started_at": scan_info["started_at"].isoformat()
            })
        
        return scans
    
    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all registered scanners"""
        health_status = {}
        
        for scanner_type, scanner in self.scanners.items():
            try:
                health_status[scanner_type.value] = await scanner.health_check()
            except Exception as e:
                self.logger.error(f"Health check failed for {scanner_type.value}: {e}")
                health_status[scanner_type.value] = False
        
        return health_status
    
    def aggregate_findings(self, results: List[ScanResult]) -> List[SecurityFinding]:
        """
        Aggregate findings from multiple scan results
        Removes duplicates and ranks by severity
        """
        all_findings = []
        seen_findings = set()
        
        for result in results:
            for finding in result.findings:
                # Create a unique key for deduplication
                finding_key = (
                    finding.endpoint,
                    finding.method,
                    finding.category,
                    finding.title
                )
                
                if finding_key not in seen_findings:
                    seen_findings.add(finding_key)
                    all_findings.append(finding)
        
        # Sort by severity (Critical first)
        severity_order = {
            SeverityLevel.CRITICAL: 0,
            SeverityLevel.HIGH: 1,
            SeverityLevel.MEDIUM: 2,
            SeverityLevel.LOW: 3,
            SeverityLevel.INFO: 4
        }
        
        all_findings.sort(key=lambda f: severity_order.get(f.severity, 5))
        return all_findings
    
    def get_scan_statistics(self) -> Dict[str, Any]:
        """Get statistics about scans and scanners"""
        stats = {
            "total_scanners": len(self.scanners),
            "active_scans": len(self.active_scans),
            "scanners": {}
        }
        
        # Count scans by scanner type
        for scan_info in self.active_scans.values():
            scanner_name = scan_info["scanner"].name
            if scanner_name not in stats["scanners"]:
                stats["scanners"][scanner_name] = {"active": 0, "completed": 0, "failed": 0}
            
            status = scan_info["status"]
            if status == "running":
                stats["scanners"][scanner_name]["active"] += 1
            elif status == "completed":
                stats["scanners"][scanner_name]["completed"] += 1
            elif status in ["failed", "stopped"]:
                stats["scanners"][scanner_name]["failed"] += 1
        
        return stats


# Global scanner manager instance
scanner_manager = ScannerManager()