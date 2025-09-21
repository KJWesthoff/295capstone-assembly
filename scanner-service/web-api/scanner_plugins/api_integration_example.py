"""
Example of how to integrate multiple scanners into your FastAPI endpoints
Add these routes to your main.py or create a separate router
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Dict, Optional
import asyncio
import uuid

from .scanner_registry import scanner_registry, get_available_scanners, health_check_scanners
from .base import ScanTarget, ScanConfig, ScannerType
from security import verify_token  # Your existing auth

router = APIRouter(prefix="/api/scanners", tags=["scanners"])


@router.get("/available")
async def list_available_scanners(user: dict = Depends(verify_token)):
    """Get list of all available scanners"""
    return {
        "scanners": get_available_scanners(),
        "total": len(scanner_registry.get_all_scanners())
    }


@router.get("/health")
async def check_scanner_health(user: dict = Depends(verify_token)):
    """Health check all scanners"""
    health_status = await health_check_scanners()
    return {
        "scanner_health": health_status,
        "overall_status": "healthy" if all(health_status.values()) else "degraded"
    }


@router.post("/scan/multi")
async def start_multi_scanner_scan(
    request: Dict = Body(...),
    user: dict = Depends(verify_token)
):
    """Start scan with multiple scanners"""
    try:
        # Parse request
        target_url = request.get("target_url")
        scanner_types = request.get("scanners", ["venti"])  # Default to VentiAPI
        scan_config = request.get("config", {})
        
        if not target_url:
            raise HTTPException(status_code=400, detail="target_url is required")
        
        # Create scan target and config
        target = ScanTarget(
            url=target_url,
            target_type=request.get("target_type", "web"),
            auth=request.get("auth"),
            metadata=request.get("metadata", {})
        )
        
        config = ScanConfig(
            timeout=scan_config.get("timeout", 300),
            intensive_scan=scan_config.get("intensive", False),
            custom_headers=scan_config.get("headers", {}),
            follow_redirects=scan_config.get("follow_redirects", True)
        )
        
        # Start scans with each requested scanner
        scan_tasks = []
        scan_results = {}
        
        for scanner_type_str in scanner_types:
            try:
                # Get scanner by type
                if scanner_type_str == "venti":
                    # Use your existing VentiAPI scanner logic
                    scan_id = str(uuid.uuid4())
                    # Your existing VentiAPI scan logic here
                    scan_results[scanner_type_str] = {
                        "scan_id": scan_id,
                        "status": "started",
                        "scanner": "VentiAPI"
                    }
                else:
                    # Get scanner from registry
                    scanner_type = ScannerType(scanner_type_str.upper())
                    scanner = scanner_registry.get_scanner_by_type(scanner_type)
                    
                    if not scanner:
                        scan_results[scanner_type_str] = {
                            "status": "error",
                            "error": f"Scanner {scanner_type_str} not available"
                        }
                        continue
                    
                    # Start scan
                    scan_id = str(uuid.uuid4())
                    task = asyncio.create_task(
                        scanner.scan(scan_id, target, config)
                    )
                    scan_tasks.append((scanner_type_str, task))
                    
                    scan_results[scanner_type_str] = {
                        "scan_id": scan_id,
                        "status": "started",
                        "scanner": scanner.name
                    }
                    
            except Exception as e:
                scan_results[scanner_type_str] = {
                    "status": "error",
                    "error": str(e)
                }
        
        return {
            "message": "Multi-scanner scan initiated",
            "scan_results": scan_results,
            "total_scanners": len(scanner_types)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/{scan_id}/results")
async def get_scan_results(
    scan_id: str,
    scanner_type: Optional[str] = None,
    user: dict = Depends(verify_token)
):
    """Get results from a specific scan"""
    # This would integrate with your existing scan result storage
    # You'll need to modify your result storage to support multiple scanner types
    pass


@router.post("/scan/compare")
async def compare_scanner_results(
    request: Dict = Body(...),
    user: dict = Depends(verify_token)
):
    """Compare results from multiple scanners"""
    scan_ids = request.get("scan_ids", [])
    
    if len(scan_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 scan IDs required for comparison")
    
    # Implementation would:
    # 1. Fetch results from each scanner
    # 2. Normalize findings across different formats
    # 3. Compare findings by endpoint/vulnerability type
    # 4. Return comparison report
    
    return {
        "message": "Comparison feature coming soon",
        "scan_ids": scan_ids
    }


# Example: Custom scanner configuration endpoints
@router.post("/configure/{scanner_type}")
async def configure_scanner(
    scanner_type: str,
    config: Dict = Body(...),
    user: dict = Depends(verify_token)
):
    """Configure specific scanner settings"""
    # Allow dynamic configuration of scanner parameters
    pass


# Example: Scanner-specific endpoints
@router.get("/nikto/templates")
async def get_nikto_templates(user: dict = Depends(verify_token)):
    """Get available Nikto scan templates/plugins"""
    nikto_scanner = scanner_registry.get_scanner_by_type(ScannerType.NIKTO)
    if not nikto_scanner:
        raise HTTPException(status_code=404, detail="Nikto scanner not available")
    
    # Return available templates/plugins
    return {
        "templates": ["all", "cgi", "ssl", "headers", "auth"],
        "description": "Available Nikto scan templates"
    }


@router.get("/nuclei/templates")
async def get_nuclei_templates(user: dict = Depends(verify_token)):
    """Get available Nuclei templates"""
    nuclei_scanner = scanner_registry.get_scanner_by_type(ScannerType.NUCLEI)
    if not nuclei_scanner:
        raise HTTPException(status_code=404, detail="Nuclei scanner not available")
    
    # This would query the Nuclei microservice for available templates
    return {
        "templates": ["cves", "vulnerabilities", "exposures", "misconfiguration"],
        "total_templates": "10000+",
        "description": "Nuclei community templates"
    }


# Add these routes to your main FastAPI app:
# app.include_router(router)