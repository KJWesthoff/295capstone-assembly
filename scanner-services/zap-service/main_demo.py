#!/usr/bin/env python3
"""
OWASP ZAP Scanner Microservice
Dedicated service for running ZAP security scans
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

app = FastAPI(title="OWASP ZAP Scanner Service", version="1.0.0")

# Models
class ScanRequest(BaseModel):
    target_url: str
    scan_type: str = "baseline"  # baseline, full, api
    openapi_spec_url: Optional[str] = None
    auth_method: Optional[str] = None
    auth_credentials: Optional[Dict] = None
    timeout: int = 600
    aggressive: bool = False

class ScanStatus(BaseModel):
    scan_id: str
    status: str
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

# Global state
active_scans: Dict[str, Dict] = {}
scan_results: Dict[str, List[Finding]] = {}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # For demo purposes, always report as healthy
    # In production, this would check actual ZAP installation
    return {
        "status": "healthy",
        "zap_available": True,
        "mode": "demo",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/scan/start")
async def start_scan(request: ScanRequest):
    """Start a new ZAP scan"""
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
    asyncio.create_task(run_zap_scan(scan_id, request))
    
    return {
        "scan_id": scan_id,
        "status": "pending",
        "message": "ZAP scan started successfully"
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
    
    active_scans[scan_id]["status"] = "stopped"
    active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()
    
    return {"message": "ZAP scan stopped successfully"}

async def run_zap_scan(scan_id: str, request: ScanRequest):
    """Run the actual ZAP scan (demo mode)"""
    try:
        logger.info(f"Starting ZAP scan {scan_id} for {request.target_url} (DEMO MODE)")
        
        # Update status to running
        active_scans[scan_id]["status"] = "running"
        active_scans[scan_id]["progress"] = 10
        
        # Simulate scan progress
        await asyncio.sleep(2)
        active_scans[scan_id]["progress"] = 30
        
        await asyncio.sleep(2)
        active_scans[scan_id]["progress"] = 60
        
        await asyncio.sleep(2)
        active_scans[scan_id]["progress"] = 80
        
        # Generate demo findings
        findings = []
        demo_findings = [
            {
                "id": "40012",
                "title": "Cross Site Scripting (Reflected)",
                "description": "Cross-site Scripting (XSS) is an attack technique that forces a web application to echo attacker-supplied executable code, which loads in a user's browser.",
                "severity": "high",
                "category": "injection",
                "endpoint": request.target_url,
                "method": "GET",
                "evidence": {
                    "plugin_id": "40012",
                    "confidence": "Medium",
                    "attack": "<script>alert(1)</script>",
                    "evidence": "script",
                    "param": "q"
                },
                "references": ["https://owasp.org/www-community/attacks/xss/"]
            },
            {
                "id": "10202",
                "title": "Absence of Anti-CSRF Tokens", 
                "description": "No Anti-CSRF tokens were found in a HTML submission form.",
                "severity": "medium",
                "category": "session-management",
                "endpoint": request.target_url + "/login",
                "method": "POST",
                "evidence": {
                    "plugin_id": "10202",
                    "confidence": "Medium",
                    "attack": "",
                    "evidence": "<form>",
                    "param": ""
                },
                "references": ["https://owasp.org/www-community/attacks/csrf"]
            }
        ]
        
        findings = demo_findings
        await asyncio.sleep(1)
        
        # Store results
        scan_results[scan_id] = findings
        
        # Update final status
        active_scans[scan_id]["status"] = "completed"
        active_scans[scan_id]["progress"] = 100
        active_scans[scan_id]["findings_count"] = len(findings)
        active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"ZAP scan {scan_id} completed with {len(findings)} findings (DEMO)")
        
    except Exception as e:
        logger.error(f"ZAP scan {scan_id} failed: {e}")
        active_scans[scan_id]["status"] = "failed"
        active_scans[scan_id]["error_message"] = str(e)
        active_scans[scan_id]["completed_at"] = datetime.utcnow().isoformat()

def convert_zap_finding(zap_alert: Dict) -> Optional[Finding]:
    """Convert ZAP alert to Finding format"""
    try:
        # Map ZAP risk levels to severity
        risk_mapping = {
            "High": "high",
            "Medium": "medium", 
            "Low": "low",
            "Informational": "info"
        }
        
        # Get first instance for endpoint info
        instances = zap_alert.get("instances", [{}])
        first_instance = instances[0] if instances else {}
        
        return Finding(
            id=str(zap_alert.get("pluginid", uuid.uuid4())),
            title=zap_alert.get("name", "Unknown Alert"),
            description=zap_alert.get("desc", ""),
            severity=risk_mapping.get(zap_alert.get("riskdesc", "Medium"), "medium"),
            category=zap_alert.get("cweid", "unknown"),
            endpoint=first_instance.get("uri", ""),
            method=first_instance.get("method", "GET"),
            evidence={
                "plugin_id": zap_alert.get("pluginid"),
                "confidence": zap_alert.get("confidence"),
                "attack": first_instance.get("attack"),
                "evidence": first_instance.get("evidence"),
                "param": first_instance.get("param")
            },
            references=zap_alert.get("reference", "").split("\n") if zap_alert.get("reference") else []
        )
    except Exception as e:
        logger.error(f"Error converting ZAP finding: {e}")
        return None

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)