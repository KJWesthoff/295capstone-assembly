#!/usr/bin/env python3
"""
Nuclei Scanner Microservice
Dedicated service for running Nuclei vulnerability scans
"""
import asyncio
import json
import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nuclei Scanner Service", version="1.0.0")

# Models
class ScanRequest(BaseModel):
    target_url: str
    templates: List[str] = ["cves", "vulnerabilities"]
    severity: List[str] = ["low", "medium", "high", "critical"]
    rate_limit: int = 5
    timeout: int = 300
    update_templates: bool = False

class ScanStatus(BaseModel):
    scan_id: str
    status: str  # pending, running, completed, failed
    progress: int
    findings_count: int
    started_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None

class Finding(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    category: str
    endpoint: str
    method: str = "GET"
    evidence: Optional[Dict] = None
    references: Optional[List[str]] = None

# Global state (in production, use Redis or database)
active_scans: Dict[str, Dict] = {}
scan_results: Dict[str, List[Finding]] = {}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check if Nuclei is available
    try:
        result = subprocess.run(["nuclei", "-version"], capture_output=True, text=True, timeout=5)
        nuclei_available = result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        nuclei_available = False
    
    return {
        "status": "healthy",
        "nuclei_available": nuclei_available,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/scan/start")
async def start_scan(request: ScanRequest):
    """Start a new Nuclei scan"""
    scan_id = str(uuid.uuid4())
    
    # Validate target URL
    if not request.target_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid target URL")
    
    # Initialize scan state
    active_scans[scan_id] = {
        "status": "pending",
        "progress": 0,
        "findings_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "request": request.dict(),
        "error_message": None
    }
    
    # Start scan in background
    asyncio.create_task(run_nuclei_scan(scan_id, request))
    
    return {
        "scan_id": scan_id,
        "status": "pending",
        "message": "Scan started successfully"
    }

@app.get("/scan/{scan_id}/status")
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
        started_at=scan_data["started_at"],
        completed_at=scan_data.get("completed_at"),
        error_message=scan_data.get("error_message")
    )

@app.get("/scan/{scan_id}/findings")
async def get_scan_findings(scan_id: str):
    """Get scan findings"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    findings = scan_results.get(scan_id, [])
    return {
        "scan_id": scan_id,
        "findings": findings,
        "total": len(findings)
    }

@app.delete("/scan/{scan_id}")
async def stop_scan(scan_id: str):
    """Stop a running scan"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Mark as stopped (in production, would kill the process)
    active_scans[scan_id]["status"] = "stopped"
    active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()
    
    return {"message": "Scan stopped successfully"}

async def run_nuclei_scan(scan_id: str, request: ScanRequest):
    """Run the actual Nuclei scan"""
    try:
        logger.info(f"Starting Nuclei scan {scan_id} for {request.target_url}")
        
        # Update status to running
        active_scans[scan_id]["status"] = "running"
        active_scans[scan_id]["progress"] = 10
        
        # Prepare Nuclei command
        cmd = [
            "nuclei",
            "-u", request.target_url,
            "-json",
            "-silent",
            "-rate-limit", str(request.rate_limit),
            "-timeout", str(request.timeout)
        ]
        
        # Add template filters
        if request.templates:
            for template in request.templates:
                cmd.extend(["-tags", template])
        
        # Add severity filter
        if request.severity:
            cmd.extend(["-severity", ",".join(request.severity)])
        
        # Update templates if requested
        if request.update_templates:
            active_scans[scan_id]["progress"] = 20
            logger.info(f"Updating Nuclei templates for scan {scan_id}")
            subprocess.run(["nuclei", "-update-templates"], check=False, timeout=60)
        
        active_scans[scan_id]["progress"] = 30
        
        # Create temporary output file
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as tmp_file:
            output_file = tmp_file.name
        
        cmd.extend(["-o", output_file])
        
        logger.info(f"Running Nuclei command: {' '.join(cmd)}")
        
        # Run Nuclei scan
        active_scans[scan_id]["progress"] = 50
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        active_scans[scan_id]["progress"] = 80
        
        # Process results
        findings = []
        try:
            if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                with open(output_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                nuclei_result = json.loads(line)
                                finding = convert_nuclei_finding(nuclei_result)
                                if finding:
                                    findings.append(finding)
                            except json.JSONDecodeError:
                                continue
            
            # Clean up temp file
            try:
                os.unlink(output_file)
            except:
                pass
                
        except Exception as e:
            logger.error(f"Error processing Nuclei results for scan {scan_id}: {e}")
        
        # Store results
        scan_results[scan_id] = findings
        
        # Update final status
        active_scans[scan_id]["status"] = "completed"
        active_scans[scan_id]["progress"] = 100
        active_scans[scan_id]["findings_count"] = len(findings)
        active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Nuclei scan {scan_id} completed with {len(findings)} findings")
        
    except Exception as e:
        logger.error(f"Nuclei scan {scan_id} failed: {e}")
        active_scans[scan_id]["status"] = "failed"
        active_scans[scan_id]["error_message"] = str(e)
        active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()

def convert_nuclei_finding(nuclei_result: Dict) -> Optional[Finding]:
    """Convert Nuclei JSON result to Finding format"""
    try:
        info = nuclei_result.get("info", {})
        
        return Finding(
            id=nuclei_result.get("template-id", str(uuid.uuid4())),
            title=info.get("name", "Unknown Finding"),
            description=info.get("description", ""),
            severity=info.get("severity", "medium").lower(),
            category=",".join(info.get("tags", [])),
            endpoint=nuclei_result.get("matched-at", ""),
            method="GET",
            evidence={
                "template": nuclei_result.get("template"),
                "type": nuclei_result.get("type"),
                "matcher_name": nuclei_result.get("matcher-name"),
                "extracted_results": nuclei_result.get("extracted-results")
            },
            references=info.get("reference", [])
        )
    except Exception as e:
        logger.error(f"Error converting Nuclei finding: {e}")
        return None

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)