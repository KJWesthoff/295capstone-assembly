import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import subprocess
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="VentiAPI Scanner Web API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (use Redis in production)
scans: Dict[str, dict] = {}

# Shared volumes
SHARED_RESULTS = Path("/shared/results")
SHARED_SPECS = Path("/shared/specs")

SHARED_RESULTS.mkdir(parents=True, exist_ok=True)
SHARED_SPECS.mkdir(parents=True, exist_ok=True)


class ScanRequest(BaseModel):
    spec_url: Optional[str] = None
    server_url: str
    rps: float = 1.0
    max_requests: int = 2000
    dangerous: bool = False
    fuzz_auth: bool = False


class ScanStatus(BaseModel):
    scan_id: str
    status: str  # pending, running, completed, failed
    progress: int  # 0-100
    current_probe: Optional[str] = None
    findings_count: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


@app.post("/api/scan/start")
async def start_scan(
    server_url: str = Form(...),
    spec_url: Optional[str] = Form(None),
    rps: float = Form(1.0),
    max_requests: int = Form(2000),
    dangerous: bool = Form(False),
    fuzz_auth: bool = Form(False),
    spec_file: Optional[UploadFile] = File(None)
):
    scan_id = str(uuid.uuid4())
    
    # Create request object for consistency
    request = ScanRequest(
        server_url=server_url,
        spec_url=spec_url,
        rps=rps,
        max_requests=max_requests,
        dangerous=dangerous,
        fuzz_auth=fuzz_auth
    )
    
    # Handle spec file upload or URL
    if spec_file:
        spec_path = SHARED_SPECS / f"{scan_id}_{spec_file.filename}"
        with open(spec_path, "wb") as f:
            content = await spec_file.read()
            f.write(content)
        spec_location = f"/shared/specs/{scan_id}_{spec_file.filename}"
    elif spec_url:
        # Check if it's a URL or pasted content
        if spec_url.startswith(('http://', 'https://')):
            spec_location = spec_url
        else:
            # Treat as pasted spec content - save to file
            spec_path = SHARED_SPECS / f"{scan_id}_pasted_spec.yaml"
            with open(spec_path, "w", encoding="utf-8") as f:
                f.write(spec_url)
            spec_location = f"/shared/specs/{scan_id}_pasted_spec.yaml"
    else:
        raise HTTPException(status_code=400, detail="Either spec_file or spec_url must be provided")
    
    # Create scan record
    scan_record = {
        "scan_id": scan_id,
        "status": "pending",
        "progress": 0,
        "current_probe": None,
        "findings_count": 0,
        "created_at": datetime.now(),
        "completed_at": None,
        "error": None,
        "request": request.dict()
    }
    scans[scan_id] = scan_record
    
    # Start scanner container asynchronously
    asyncio.create_task(run_scanner(scan_id, spec_location, request))
    
    return {"scan_id": scan_id, "status": "pending"}


async def run_scanner(scan_id: str, spec_location: str, request: ScanRequest):
    """Run the scanner in a separate container"""
    try:
        scans[scan_id]["status"] = "running"
        
        # Prepare docker run command
        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "scannerapp_scanner-network",
            "-v", "scannerapp_shared-results:/shared/results",
            "-v", "scannerapp_shared-specs:/shared/specs",
            "ventiapi-scanner",
            "--spec", spec_location,
            "--server", request.server_url,
            "--out", f"/shared/results/{scan_id}",
            "--rps", str(request.rps),
            "--max-requests", str(request.max_requests)
        ]
        
        if request.dangerous:
            docker_cmd.append("--dangerous")
        if request.fuzz_auth:
            docker_cmd.append("--fuzz-auth")
        
        # Run scanner container using subprocess
        process = await asyncio.create_subprocess_exec(
            *docker_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            # Parse results
            results_dir = SHARED_RESULTS / scan_id
            findings_file = results_dir / "findings.json"
            
            if findings_file.exists():
                with open(findings_file) as f:
                    findings = json.load(f)
                scans[scan_id]["findings_count"] = len(findings)
            
            scans[scan_id]["status"] = "completed"
            scans[scan_id]["progress"] = 100
            scans[scan_id]["completed_at"] = datetime.now()
        else:
            error_msg = stderr.decode() if stderr else stdout.decode()
            scans[scan_id]["status"] = "failed"
            scans[scan_id]["error"] = error_msg
            
    except Exception as e:
        scans[scan_id]["status"] = "failed"
        scans[scan_id]["error"] = str(e)


@app.get("/api/scan/{scan_id}/status")
async def get_scan_status(scan_id: str) -> ScanStatus:
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    return ScanStatus(**scan_data)


@app.get("/api/scan/{scan_id}/findings")
async def get_findings(scan_id: str, offset: int = 0, limit: int = 50):
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    findings_file = SHARED_RESULTS / scan_id / "findings.json"
    if not findings_file.exists():
        return {"findings": [], "total": 0, "nextOffset": None}
    
    with open(findings_file) as f:
        all_findings = json.load(f)
    
    paginated_findings = all_findings[offset:offset + limit]
    next_offset = offset + limit if offset + limit < len(all_findings) else None
    
    return {
        "findings": paginated_findings,
        "total": len(all_findings),
        "nextOffset": next_offset
    }


@app.get("/api/scan/{scan_id}/report")
async def get_report(scan_id: str):
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    report_file = SHARED_RESULTS / scan_id / "report.html"
    if not report_file.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    
    return FileResponse(report_file, media_type="text/html")


@app.get("/api/scans")
async def list_scans():
    return [
        {
            "scan_id": scan_id,
            "status": scan_data["status"],
            "created_at": scan_data["created_at"],
            "server_url": scan_data["request"]["server_url"]
        }
        for scan_id, scan_data in scans.items()
    ]


@app.delete("/api/scan/{scan_id}")
async def delete_scan(scan_id: str):
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Clean up files
    results_dir = SHARED_RESULTS / scan_id
    if results_dir.exists():
        import shutil
        shutil.rmtree(results_dir)
    
    # Remove from memory
    del scans[scan_id]
    
    return {"message": "Scan deleted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)