"""
VentiAPI Scanner Microservice
Independent scanner service for VentiAPI security scanning
"""
import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

# Import the scanner module
from scanner.core.scanner import VentiAPIScanner as CoreScanner
from scanner.core.config import ScanConfig

app = FastAPI(title="VentiAPI Scanner Service", version="1.0.0")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global scanner instance
scanner = CoreScanner()
active_scans: Dict[str, Dict] = {}

class ScanRequest(BaseModel):
    target_url: str
    spec_content: Optional[str] = None
    max_requests: int = 100
    requests_per_second: float = 2.0
    dangerous_mode: bool = False

class ScanResponse(BaseModel):
    scan_id: str
    status: str
    message: str

class ScanStatus(BaseModel):
    scan_id: str
    status: str
    progress: int
    findings_count: int
    error: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "venti-scanner", "version": "1.0.0"}

@app.post("/scan/start", response_model=ScanResponse)
async def start_scan(
    target_url: str = Form(...),
    spec_file: Optional[UploadFile] = File(None),
    max_requests: int = Form(100),
    requests_per_second: float = Form(2.0),
    dangerous_mode: bool = Form(False)
):
    """Start a new VentiAPI security scan"""
    try:
        scan_id = str(uuid.uuid4())
        logger.info(f"Starting VentiAPI scan {scan_id} for {target_url}")
        
        # Create scan configuration
        config = ScanConfig(
            target_url=target_url,
            max_requests=max_requests,
            requests_per_second=requests_per_second,
            dangerous_mode=dangerous_mode
        )
        
        # Handle spec file if provided
        if spec_file:
            spec_content = await spec_file.read()
            config.spec_content = spec_content.decode('utf-8')
        
        # Initialize scan state
        active_scans[scan_id] = {
            "status": "starting",
            "progress": 0,
            "findings_count": 0,
            "config": config,
            "created_at": datetime.now().isoformat(),
            "error": None
        }
        
        # Start scan asynchronously
        asyncio.create_task(run_scan(scan_id, config))
        
        return ScanResponse(
            scan_id=scan_id,
            status="started",
            message="VentiAPI scan initiated"
        )
        
    except Exception as e:
        logger.error(f"Failed to start scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scan/{scan_id}/status", response_model=ScanStatus)
async def get_scan_status(scan_id: str):
    """Get scan status"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = active_scans[scan_id]
    return ScanStatus(
        scan_id=scan_id,
        status=scan_data["status"],
        progress=scan_data["progress"],
        findings_count=scan_data["findings_count"],
        error=scan_data.get("error")
    )

@app.get("/scan/{scan_id}/findings")
async def get_scan_findings(scan_id: str):
    """Get scan findings"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    findings_file = Path(f"/tmp/venti_results/{scan_id}/findings.json")
    
    if not findings_file.exists():
        return {"findings": [], "total": 0}
    
    try:
        with open(findings_file, 'r') as f:
            findings = json.load(f)
        return {"findings": findings, "total": len(findings)}
    except Exception as e:
        logger.error(f"Failed to load findings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_scan(scan_id: str, config: ScanConfig):
    """Run the VentiAPI scan"""
    try:
        # Update status to running
        active_scans[scan_id]["status"] = "running"
        active_scans[scan_id]["progress"] = 10
        
        # Create results directory
        results_dir = Path(f"/tmp/venti_results/{scan_id}")
        results_dir.mkdir(parents=True, exist_ok=True)
        
        # Run the scanner
        logger.info(f"Running VentiAPI scanner for scan {scan_id}")
        results = await scanner.scan_async(config, results_dir)
        
        # Update progress
        active_scans[scan_id]["progress"] = 90
        active_scans[scan_id]["findings_count"] = len(results.get("findings", []))
        
        # Save findings to file
        findings_file = results_dir / "findings.json"
        with open(findings_file, 'w') as f:
            json.dump(results.get("findings", []), f, indent=2)
        
        # Mark as completed
        active_scans[scan_id]["status"] = "completed"
        active_scans[scan_id]["progress"] = 100
        
        logger.info(f"VentiAPI scan {scan_id} completed with {len(results.get('findings', []))} findings")
        
    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        active_scans[scan_id]["status"] = "failed"
        active_scans[scan_id]["error"] = str(e)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)