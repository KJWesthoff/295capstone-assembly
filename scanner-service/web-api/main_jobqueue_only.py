"""
Railway-Compatible VentiAPI Scanner Web API
Uses Redis job queue for microservice scanner workers
"""
import asyncio
import json
import uuid
import os
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field

# Import our security module
from security import (
    verify_token, require_admin, user_db, create_access_token,
    validate_file_upload, validate_url, sanitize_path, 
    SecurityHeaders, limiter, RateLimits, validate_scan_params, 
    log_security_event, SecurityConfig
)

# Import job queue
from job_queue import job_queue

# Configuration
SHARED_RESULTS = Path("/shared/results")
SHARED_SPECS = Path("/shared/specs")
SHARED_RESULTS.mkdir(parents=True, exist_ok=True)
SHARED_SPECS.mkdir(parents=True, exist_ok=True)

def get_allowed_origins():
    """Get allowed CORS origins based on environment"""
    origins = [
        "http://localhost:3000",
        "http://localhost:3001"
    ]
    
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url)
    
    additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS")
    if additional_origins:
        origins.extend([origin.strip() for origin in additional_origins.split(",")])
    
    return origins

# FastAPI app with security middleware
app = FastAPI(
    title="VentiAPI Scanner - Railway Edition",
    description="Microservice API Security Scanner with Redis Job Queue",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add security headers
app.add_middleware(SecurityHeaders)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# In-memory scan tracking (replace with Redis in production)
scans: Dict[str, Dict] = {}

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class ScanResponse(BaseModel):
    scan_id: str
    status: str

class ScanStatus(BaseModel):
    scan_id: str
    status: str
    progress: int = 0
    current_phase: str = "Initializing"
    findings_count: int = 0
    parallel_mode: bool = False
    total_chunks: int = 1
    chunk_status: List[Dict] = []
    job_ids: List[str] = []
    queue_stats: Dict = {}

# Utility functions
def split_openapi_spec_by_endpoints(spec_content: str, chunk_size: int = 4) -> List[str]:
    """Split OpenAPI spec into smaller chunks by endpoints"""
    try:
        spec = yaml.safe_load(spec_content)
        
        if 'paths' not in spec or not spec['paths']:
            return [spec_content]  # Return original if no paths
            
        paths = spec['paths']
        path_items = list(paths.items())
        
        if len(path_items) <= chunk_size:
            return [spec_content]  # Don't split if small enough
            
        chunks = []
        for i in range(0, len(path_items), chunk_size):
            chunk_paths = dict(path_items[i:i + chunk_size])
            
            # Create new spec with chunk of paths
            chunk_spec = spec.copy()
            chunk_spec['paths'] = chunk_paths
            
            # Convert back to YAML
            chunk_yaml = yaml.dump(chunk_spec, default_flow_style=False)
            chunks.append(chunk_yaml)
            
        return chunks
        
    except Exception as e:
        print(f"Error splitting spec: {e}")
        return [spec_content]  # Return original on error

# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    try:
        # Check Redis connection
        queue_stats = job_queue.get_queue_stats()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "queue_stats": queue_stats
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/api/auth/login")
@limiter.limit(RateLimits.AUTH)
async def login(request: Request, login_req: LoginRequest):
    """Authenticate user and return JWT token"""
    
    log_security_event("login_attempt", login_req.username, {
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent", "unknown")
    })
    
    if login_req.username not in user_db.users:
        log_security_event("login_failed", login_req.username, {
            "reason": "user_not_found",
            "ip": request.client.host
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    user = user_db.users[login_req.username]
    
    if not user_db.verify_password(login_req.password, user['password_hash']):
        log_security_event("login_failed", login_req.username, {
            "reason": "invalid_password",
            "ip": request.client.host
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    access_token = create_access_token(data={"username": login_req.username})
    
    log_security_event("login_success", login_req.username, {
        "ip": request.client.host,
        "is_admin": user.get('is_admin', False)
    })
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/scan/start", response_model=ScanResponse)
@limiter.limit(RateLimits.SCAN)
async def start_scan(
    request: Request,
    user: Dict = Depends(verify_token),
    server_url: str = Form(...),
    target_url: Optional[str] = Form(None),
    rps: float = Form(2.0),
    max_requests: int = Form(400),
    dangerous: bool = Form(False),
    fuzz_auth: bool = Form(False),
    spec_file: Optional[UploadFile] = File(None)
):
    """Start a new security scan using job queue"""
    
    print("DEBUG: Scan request received")
    print(f"DEBUG: server_url={server_url}")
    print(f"DEBUG: target_url={target_url}")
    print(f"DEBUG: rps={rps}")
    print(f"DEBUG: max_requests={max_requests}")
    print(f"DEBUG: dangerous={dangerous}")
    print(f"DEBUG: fuzz_auth={fuzz_auth}")
    print(f"DEBUG: spec_file={spec_file}")
    print(f"DEBUG: user={user}")
    
    # Validate scan parameters
    validate_scan_params(server_url, target_url, rps, max_requests, user)
    
    # Only admins can run dangerous scans
    if dangerous and not user.get('is_admin'):
        log_security_event("unauthorized_dangerous_scan", user['username'], {
            "ip": request.client.host
        })
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for dangerous scans"
        )
    
    # Validate and save spec file if provided
    spec_location = None
    if spec_file:
        validate_file_upload(spec_file)
        
        scan_id = str(uuid.uuid4())
        spec_filename = f"{scan_id}_{spec_file.filename}"
        spec_path = SHARED_SPECS / spec_filename
        
        with open(spec_path, "wb") as f:
            content = await spec_file.read()
            f.write(content)
        
        spec_location = f"/shared/specs/{spec_filename}"
    else:
        scan_id = str(uuid.uuid4())
    
    # Initialize scan data
    scans[scan_id] = {
        "status": "pending",
        "progress": 0,
        "current_phase": "Initializing scan",
        "findings_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "server_url": server_url,
        "target_url": target_url,
        "spec_location": spec_location,
        "parallel_mode": False,
        "total_chunks": 1,
        "job_ids": [],
        "dangerous": dangerous,
        "fuzz_auth": fuzz_auth
    }
    
    log_security_event("scan_started", user['username'], {
        "scan_id": scan_id,
        "ip": request.client.host,
        "server_url": server_url,
        "dangerous": dangerous
    })
    
    # Start scan job asynchronously
    asyncio.create_task(execute_scan_with_queue(scan_id, user, dangerous, fuzz_auth, rps, max_requests))
    
    # Update user scan count
    user_db.users[user['username']]['scan_count'] += 1
    
    return {"scan_id": scan_id, "status": "pending"}

async def execute_scan_with_queue(scan_id: str, user: Dict, dangerous: bool, fuzz_auth: bool, rps: float, max_requests: int):
    """Execute scan using Redis job queue"""
    try:
        scan_data = scans[scan_id]
        scan_data["status"] = "running"
        scan_data["current_phase"] = "Processing scan request"
        scan_data["progress"] = 5
        
        # Get scan parameters
        server_url = scan_data["server_url"]
        spec_location = scan_data["spec_location"]
        
        scan_params = {
            'server_url': server_url,
            'spec_location': spec_location,
            'dangerous': dangerous,
            'fuzz_auth': fuzz_auth,
            'rps': rps,
            'max_requests': max_requests
        }
        
        if spec_location:
            # Read and analyze spec file for chunking
            try:
                with open(spec_location.replace('/shared/specs/', str(SHARED_SPECS) + '/'), 'r') as f:
                    spec_content = f.read()
                
                # Split spec into chunks for parallel processing
                spec_chunks = split_openapi_spec_by_endpoints(spec_content, chunk_size=4)
                
                if len(spec_chunks) > 1:
                    # Multiple chunks - parallel processing
                    scan_data["parallel_mode"] = True
                    scan_data["total_chunks"] = len(spec_chunks)
                    scan_data["current_phase"] = f"Starting parallel scan ({len(spec_chunks)} workers)"
                    scan_data["progress"] = 10
                    
                    # Save chunk specs to shared volume
                    chunk_specs = []
                    for i, chunk_spec in enumerate(spec_chunks):
                        chunk_id = f"{scan_id}_chunk_{i}"
                        chunk_path = SHARED_SPECS / f"{chunk_id}_spec.yaml"
                        
                        with open(chunk_path, 'w') as f:
                            f.write(chunk_spec)
                        
                        chunk_specs.append(f"/shared/specs/{chunk_id}_spec.yaml")
                    
                    # Create jobs for parallel processing
                    job_ids = job_queue.create_scan_jobs(scan_id, chunk_specs, scan_params)
                    scan_data["job_ids"] = job_ids
                    
                    print(f"Created {len(job_ids)} parallel scan jobs for {scan_id}")
                    
                else:
                    # Single chunk - normal processing
                    job_id = job_queue.create_single_scan_job(scan_id, scan_params)
                    scan_data["job_ids"] = [job_id]
                    print(f"Created single scan job {job_id} for {scan_id}")
                    
            except Exception as e:
                print(f"Error processing spec file: {e}")
                # Fallback to single job
                job_id = job_queue.create_single_scan_job(scan_id, scan_params)
                scan_data["job_ids"] = [job_id]
        else:
            # No spec file - single job using OpenAPI endpoint
            job_id = job_queue.create_single_scan_job(scan_id, scan_params)
            scan_data["job_ids"] = [job_id]
            print(f"Created single scan job {job_id} for {scan_id} (no spec file)")
        
        scan_data["status"] = "queued"
        scan_data["current_phase"] = "Queued for processing"
        scan_data["progress"] = 15
        
        # Monitor job progress
        await monitor_scan_jobs(scan_id)
        
    except Exception as e:
        print(f"Scan execution failed: {e}")
        scan_data = scans.get(scan_id, {})
        scan_data["status"] = "failed"
        scan_data["error"] = str(e)
        scan_data["progress"] = 100
        scan_data["current_phase"] = "Scan failed"
        
        log_security_event("scan_error", user['username'], {
            "scan_id": scan_id,
            "error": str(e)
        })

async def monitor_scan_jobs(scan_id: str):
    """Monitor job progress and update scan status"""
    scan_data = scans.get(scan_id)
    if not scan_data:
        return
        
    job_ids = scan_data.get("job_ids", [])
    if not job_ids:
        return
    
    print(f"Monitoring {len(job_ids)} jobs for scan {scan_id}")
    
    while True:
        try:
            # Get status of all jobs
            job_statuses = []
            for job_id in job_ids:
                status = job_queue.get_job_status(job_id)
                job_statuses.append(status)
            
            # Calculate overall progress
            total_progress = sum(job['progress'] for job in job_statuses)
            overall_progress = min(95, total_progress // len(job_statuses)) if job_statuses else 0
            
            # Check if all jobs are complete
            completed_jobs = [job for job in job_statuses if job['status'] == 'completed']
            failed_jobs = [job for job in job_statuses if job['status'] == 'failed']
            
            scan_data["progress"] = overall_progress
            
            # Update current phase based on job statuses
            if failed_jobs:
                scan_data["status"] = "failed"
                scan_data["current_phase"] = "Scan failed"
                scan_data["progress"] = 100
                scan_data["error"] = failed_jobs[0].get('error', 'Unknown error')
                break
                
            elif len(completed_jobs) == len(job_ids):
                # All jobs completed successfully
                scan_data["status"] = "completed"
                scan_data["current_phase"] = "Scan completed"
                scan_data["progress"] = 100
                scan_data["completed_at"] = datetime.utcnow().isoformat()
                
                # Aggregate findings
                total_findings = 0
                for job in completed_jobs:
                    total_findings += job.get('findings_count', 0)
                
                scan_data["findings_count"] = total_findings
                print(f"Scan {scan_id} completed with {total_findings} findings")
                break
                
            else:
                # Jobs still running
                running_jobs = [job for job in job_statuses if job['status'] in ['running', 'queued']]
                if running_jobs:
                    scan_data["current_phase"] = f"Processing ({len(completed_jobs)}/{len(job_ids)} workers completed)"
                
            # Wait before next check
            await asyncio.sleep(2)
            
        except Exception as e:
            print(f"Error monitoring jobs for scan {scan_id}: {e}")
            await asyncio.sleep(5)

@app.get("/api/scan/{scan_id}/status", response_model=ScanStatus)
async def get_scan_status(scan_id: str, user: Dict = Depends(verify_token)):
    """Get current scan status with job queue information"""
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    
    # Get job statuses
    job_ids = scan_data.get("job_ids", [])
    chunk_status = []
    
    for i, job_id in enumerate(job_ids):
        job_status = job_queue.get_job_status(job_id)
        chunk_status.append({
            "chunk_id": i,
            "job_id": job_id,
            "status": job_status.get('status', 'unknown'),
            "progress": job_status.get('progress', 0),
            "current_phase": job_status.get('phase', 'Unknown'),
            "worker_id": job_status.get('worker_id'),
            "findings_count": job_status.get('findings_count', 0)
        })
    
    # Get queue statistics
    queue_stats = job_queue.get_queue_stats()
    
    return ScanStatus(
        scan_id=scan_id,
        status=scan_data.get("status", "unknown"),
        progress=scan_data.get("progress", 0),
        current_phase=scan_data.get("current_phase", "Unknown"),
        findings_count=scan_data.get("findings_count", 0),
        parallel_mode=scan_data.get("parallel_mode", False),
        total_chunks=scan_data.get("total_chunks", 1),
        chunk_status=chunk_status,
        job_ids=job_ids,
        queue_stats=queue_stats
    )

@app.get("/api/scan/{scan_id}/findings")
async def get_scan_findings(
    scan_id: str, 
    offset: int = 0, 
    limit: int = 50,
    user: Dict = Depends(verify_token)
):
    """Get scan findings from job results"""
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Get all results for this scan
    scan_results = job_queue.get_scan_results(scan_id)
    
    # Aggregate all findings
    all_findings = []
    for result in scan_results:
        findings = result.get('findings', [])
        all_findings.extend(findings)
    
    # Apply pagination
    total_findings = len(all_findings)
    paginated_findings = all_findings[offset:offset + limit]
    
    return {
        "scan_id": scan_id,
        "total": total_findings,
        "offset": offset,
        "limit": limit,
        "findings": paginated_findings
    }

@app.get("/api/scans")
async def list_scans(user: Dict = Depends(verify_token)):
    """List all scans for the user"""
    return {"scans": list(scans.values())}

@app.delete("/api/scan/{scan_id}")
async def delete_scan(scan_id: str, user: Dict = Depends(verify_token)):
    """Delete a scan and cleanup job data"""
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Cancel any running jobs
    cancelled_jobs = job_queue.cancel_scan_jobs(scan_id)
    
    # Remove scan data
    del scans[scan_id]
    
    # Cleanup shared files
    try:
        result_dir = SHARED_RESULTS / scan_id
        if result_dir.exists():
            import shutil
            shutil.rmtree(result_dir)
    except Exception as e:
        print(f"Warning: Could not cleanup result directory: {e}")
    
    return {
        "message": "Scan deleted successfully",
        "cancelled_jobs": cancelled_jobs
    }

@app.get("/api/queue/stats")
async def get_queue_stats(user: Dict = Depends(require_admin)):
    """Get queue statistics (admin only)"""
    return job_queue.get_queue_stats()

@app.post("/api/queue/cleanup")
async def cleanup_old_jobs(user: Dict = Depends(require_admin)):
    """Cleanup old job data (admin only)"""
    cleaned_count = job_queue.cleanup_old_jobs()
    return {"message": f"Cleaned up {cleaned_count} old job records"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)