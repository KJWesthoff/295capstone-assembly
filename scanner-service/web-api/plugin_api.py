"""
New API endpoints using the scanner plugin architecture
This demonstrates the plugin system and can be gradually integrated
"""
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile
from pydantic import BaseModel

import shutil
from scanner_plugins.manager import scanner_manager
from scanner_plugins.base import ScanTarget, ScanConfig, ScannerType
from security import verify_token, validate_url, validate_file_upload
from scanner_integration import scanner_integration

# Check if Docker is available (for Railway compatibility)
DOCKER_AVAILABLE = shutil.which('docker') is not None

# Create API router
plugin_router = APIRouter(prefix="/api/v2", tags=["Scanner Plugins"])


class ScannerInfoResponse(BaseModel):
    """Scanner information response"""
    scanners: List[Dict]
    total_count: int


class StartScanRequest(BaseModel):
    """Request model for starting a scan with plugin system"""
    target_url: str
    scanner_type: Optional[str] = "venti-api"
    max_requests: int = 100
    requests_per_second: float = 1.0
    dangerous_mode: bool = False
    fuzz_auth: bool = False


class ScanStatusResponse(BaseModel):
    """Scan status response"""
    scan_id: str
    status: str
    scanner_type: str
    target_url: str
    progress: int
    findings_count: int
    started_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


@plugin_router.get("/scanners", response_model=ScannerInfoResponse)
async def get_available_scanners(user: Dict = Depends(verify_token)):
    """Get list of available scanner plugins and their capabilities"""
    
    try:
        scanners = scanner_manager.get_available_scanners()
        
        # Add health status
        health_status = await scanner_manager.health_check_all()
        
        for scanner in scanners:
            scanner_type = scanner["type"]
            scanner["healthy"] = health_status.get(scanner_type, False)
        
        return ScannerInfoResponse(
            scanners=scanners,
            total_count=len(scanners)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting scanners: {str(e)}")


@plugin_router.post("/scan/start")
async def start_plugin_scan(
    target_url: str = Form(...),
    scanner_type: str = Form("venti-api"),
    max_requests: int = Form(100),
    requests_per_second: float = Form(1.0),
    dangerous_mode: bool = Form(False),
    fuzz_auth: bool = Form(False),
    spec_file: Optional[UploadFile] = File(None),
    user: Dict = Depends(verify_token)
):
    """Start a scan using the plugin architecture"""
    
    try:
        # Validate inputs
        allow_localhost = user.get('is_admin', False)
        target_url = validate_url(target_url, allow_localhost=allow_localhost)
        
        # Validate scanner type
        try:
            scanner_enum = ScannerType(scanner_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid scanner type: {scanner_type}")
        
        # Check if scanner is available
        scanner = scanner_manager.get_scanner(scanner_enum)
        if not scanner:
            raise HTTPException(status_code=400, detail=f"Scanner {scanner_type} not available")
        
        # Only admins can run dangerous scans
        if dangerous_mode and not user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin privileges required for dangerous scans")
        
        # Handle spec file
        spec_file_path = None
        if spec_file:
            # Validate and save spec file
            file_content = await spec_file.read()
            validate_file_upload(file_content, spec_file.filename)
            
            # Save to shared specs directory
            from pathlib import Path
            import uuid
            
            shared_specs = Path("/shared/specs")
            safe_filename = f"{uuid.uuid4()}_{spec_file.filename}"
            spec_path = shared_specs / safe_filename
            
            with open(spec_path, "wb") as f:
                f.write(file_content)
            
            spec_file_path = f"/shared/specs/{safe_filename}"
        
        # Create scan target and config
        target = ScanTarget(
            url=target_url,
            spec_file=spec_file_path,
            target_type="api"
        )
        
        config = ScanConfig(
            max_requests=max_requests,
            requests_per_second=requests_per_second,
            timeout=600,
            dangerous_mode=dangerous_mode,
            fuzz_auth=fuzz_auth
        )
        
        # Generate scan ID
        import uuid
        scan_id = str(uuid.uuid4())
        
        # Start scan asynchronously
        import asyncio
        asyncio.create_task(
            scanner_manager.start_scan(
                scan_id=scan_id,
                target=target,
                config=config,
                scanner_type=scanner_enum,
                user_info=user
            )
        )
        
        return {
            "scan_id": scan_id,
            "status": "pending",
            "scanner_type": scanner_type,
            "target_url": target_url
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting scan: {str(e)}")


@plugin_router.get("/scan/{scan_id}/status", response_model=ScanStatusResponse)
async def get_plugin_scan_status(scan_id: str, user: Dict = Depends(verify_token)):
    """Get status of a plugin-based scan"""
    
    try:
        # Get scan status from plugin manager
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if not scan_status:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        # Check ownership (admins can see all scans)
        if (scan_status.get("user", {}).get("username") != user["username"] and 
            not user.get("is_admin")):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Extract information
        scanner = scan_status["scanner"]
        target = scan_status["target"]
        status = scan_status["status"]
        
        # Get result if available
        result = scan_status.get("result")
        if result:
            return ScanStatusResponse(
                scan_id=scan_id,
                status=result.status,
                scanner_type=result.scanner_type.value,
                target_url=result.target.url,
                progress=100 if result.status in ["completed", "failed"] else 50,
                findings_count=len(result.findings),
                started_at=result.started_at.isoformat(),
                completed_at=result.completed_at.isoformat() if result.completed_at else None,
                error_message=result.error_message
            )
        else:
            # Scan still running
            return ScanStatusResponse(
                scan_id=scan_id,
                status=status,
                scanner_type=scanner.scanner_type.value,
                target_url=target.url,
                progress=25,  # Estimated progress
                findings_count=0,
                started_at=scan_status["started_at"].isoformat()
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting scan status: {str(e)}")


@plugin_router.get("/scan/{scan_id}/findings")
async def get_plugin_scan_findings(
    scan_id: str,
    offset: int = 0,
    limit: int = 50,
    user: Dict = Depends(verify_token)
):
    """Get findings from a plugin-based scan"""
    
    try:
        # Get scan status to check ownership
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if not scan_status:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        # Check ownership
        if (scan_status.get("user", {}).get("username") != user["username"] and 
            not user.get("is_admin")):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get result
        result = scan_status.get("result")
        if not result or result.status != "completed":
            return {"findings": [], "total": 0}
        
        # Convert findings to legacy format for compatibility
        all_findings = []
        for finding in result.findings:
            finding_dict = {
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
            all_findings.append(finding_dict)
        
        # Apply pagination
        total = len(all_findings)
        findings = all_findings[offset:offset + limit]
        
        response = {
            "findings": findings,
            "total": total
        }
        
        if offset + limit < total:
            response["nextOffset"] = offset + limit
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting findings: {str(e)}")


@plugin_router.delete("/scan/{scan_id}")
async def stop_plugin_scan(scan_id: str, user: Dict = Depends(verify_token)):
    """Stop a plugin-based scan"""
    
    try:
        # Get scan status to check ownership
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if not scan_status:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        # Check ownership
        if (scan_status.get("user", {}).get("username") != user["username"] and 
            not user.get("is_admin")):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Stop the scan
        success = await scanner_manager.stop_scan(scan_id)
        
        if success:
            return {"message": "Scan stopped successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to stop scan")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping scan: {str(e)}")


@plugin_router.get("/scans")
async def list_plugin_scans(user: Dict = Depends(verify_token)):
    """List scans from plugin system"""
    
    try:
        if user.get("is_admin"):
            scans = scanner_manager.get_active_scans()
        else:
            scans = scanner_manager.get_active_scans(user["username"])
        
        return {"scans": scans}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing scans: {str(e)}")


@plugin_router.get("/statistics")
async def get_scanner_statistics(admin_user: Dict = Depends(verify_token)):
    """Get scanner statistics (admin only)"""
    
    if not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    try:
        stats = scanner_manager.get_scan_statistics()
        health_status = await scanner_manager.health_check_all()
        
        stats["scanner_health"] = health_status
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting statistics: {str(e)}")