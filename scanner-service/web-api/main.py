import asyncio
import json
import uuid
import yaml
import re
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


def split_openapi_spec_by_endpoints(spec_content: str, chunk_size: int = 4) -> List[str]:
    """Split OpenAPI spec into smaller specs with fewer endpoints each"""
    try:
        spec = yaml.safe_load(spec_content)
        
        if 'paths' not in spec or not spec['paths']:
            return [spec_content]
        
        paths = spec['paths']
        path_items = list(paths.items())
        
        # If we have fewer paths than chunk_size, just return the original spec
        if len(path_items) <= chunk_size:
            return [spec_content]
        
        # Split paths into chunks
        chunks = []
        for i in range(0, len(path_items), chunk_size):
            chunk_paths = dict(path_items[i:i+chunk_size])
            
            # Create new spec with this subset of paths
            chunk_spec = spec.copy()
            chunk_spec['paths'] = chunk_paths
            
            chunks.append(yaml.dump(chunk_spec, default_flow_style=False))
        
        print(f"Split spec into {len(chunks)} chunks ({len(path_items)} total endpoints)")
        return chunks
    except Exception as e:
        print(f"Failed to split spec: {e}, using original")
        return [spec_content]


def merge_scan_findings(scan_id: str, num_chunks: int) -> Dict:
    """Merge findings from multiple chunk scans into one result"""
    merged_findings = []
    total_processed = 0
    
    for i in range(num_chunks):
        chunk_id = f"{scan_id}_chunk_{i}"
        findings_file = SHARED_RESULTS / chunk_id / "findings.json"
        
        if findings_file.exists():
            with open(findings_file) as f:
                chunk_findings = json.load(f)
                merged_findings.extend(chunk_findings)
                total_processed += 1
    
    # Save merged findings to main scan directory
    main_results_dir = SHARED_RESULTS / scan_id
    main_results_dir.mkdir(exist_ok=True)
    
    merged_file = main_results_dir / "findings.json"
    with open(merged_file, 'w') as f:
        json.dump(merged_findings, f, indent=2)
    
    print(f"Merged {len(merged_findings)} findings from {total_processed}/{num_chunks} chunks")
    return {
        "total_findings": len(merged_findings),
        "chunks_processed": total_processed,
        "chunks_expected": num_chunks
    }


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
    # Enhanced parallel scanning info
    total_chunks: Optional[int] = None
    completed_chunks: Optional[int] = None
    parallel_mode: Optional[bool] = None
    chunk_status: Optional[List[dict]] = None
    current_phase: Optional[str] = None


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
        content = await spec_file.read()
        # Fix server URLs in spec content to match the target server
        content_str = content.decode('utf-8')
        # Replace localhost:5000 with the actual server URL in the spec
        import re
        content_str = re.sub(r'http://localhost:\d+', server_url, content_str)
        content_str = re.sub(r'http://127\.0\.0\.1:\d+', server_url, content_str)
        with open(spec_path, "w", encoding="utf-8") as f:
            f.write(content_str)
        spec_location = f"/shared/specs/{scan_id}_{spec_file.filename}"
    elif spec_url:
        # Check if it's a URL or pasted content
        if spec_url.startswith(('http://', 'https://')):
            spec_location = spec_url
        else:
            # Treat as pasted spec content - save to file and fix server URLs
            spec_content = spec_url
            # Replace localhost:5000 with the actual server URL in the spec
            import re
            spec_content = re.sub(r'http://localhost:\d+', server_url, spec_content)
            spec_content = re.sub(r'http://127\.0\.0\.1:\d+', server_url, spec_content)
            spec_path = SHARED_SPECS / f"{scan_id}_pasted_spec.yaml"
            with open(spec_path, "w", encoding="utf-8") as f:
                f.write(spec_content)
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
        "request": request.dict(),
        # Enhanced parallel scanning info
        "total_chunks": None,
        "completed_chunks": 0,
        "parallel_mode": None,
        "chunk_status": [],
        "current_phase": "Initializing"
    }
    scans[scan_id] = scan_record
    
    # Start scanner container asynchronously
    asyncio.create_task(run_scanner(scan_id, spec_location, request))
    
    return {"scan_id": scan_id, "status": "pending"}


async def run_single_scanner_chunk(chunk_id: str, spec_location: str, scanner_server_url: str, request: ScanRequest, scan_id: str = None):
    """Run a single scanner container for one chunk of endpoints with progress monitoring"""
    # Use host network if URL is external, otherwise use scanner network
    if scanner_server_url.startswith(('http://host.docker.internal:')):
        # Internal/local URLs - use scanner network
        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "scannerapp_scanner-network",
            "--add-host", "host.docker.internal:host-gateway",
            "-v", "scannerapp_shared-results:/shared/results",
            "-v", "scannerapp_shared-specs:/shared/specs",
            "ventiapi-scanner",
            "--spec", spec_location,
            "--server", scanner_server_url,
            "--out", f"/shared/results/{chunk_id}",
            "--rps", str(request.rps),
            "--max-requests", str(request.max_requests)
        ]
    else:
        # External URLs - use host network for full internet access
        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "host",
            "-v", "scannerapp_shared-results:/shared/results",
            "-v", "scannerapp_shared-specs:/shared/specs",
            "ventiapi-scanner",
            "--spec", spec_location,
            "--server", scanner_server_url,
            "--out", f"/shared/results/{chunk_id}",
            "--rps", str(request.rps),
            "--max-requests", str(request.max_requests)
        ]
    
    if request.dangerous:
        docker_cmd.append("--dangerous")
    if request.fuzz_auth:
        docker_cmd.append("--fuzz-auth")
    
    print(f"Starting scanner chunk: {chunk_id}")
    
    # Run scanner container using subprocess with real-time monitoring
    process = await asyncio.create_subprocess_exec(
        *docker_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    # Create progress monitoring task
    if scan_id:
        monitor_task = asyncio.create_task(monitor_chunk_progress(chunk_id, scan_id, process))
    
    stdout, stderr = await process.communicate()
    
    # Cancel monitoring task if it exists
    if scan_id and 'monitor_task' in locals():
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
    
    if process.returncode == 0:
        print(f"Chunk {chunk_id} completed successfully")
        return {"success": True, "chunk_id": chunk_id}
    else:
        error_msg = stderr.decode() if stderr else stdout.decode()
        print(f"Chunk {chunk_id} failed: {error_msg}")
        return {"success": False, "chunk_id": chunk_id, "error": error_msg}


async def monitor_chunk_progress(chunk_id: str, scan_id: str, process):
    """Monitor progress of a single chunk by simulating progress and endpoint scanning"""
    try:
        # Find the chunk index and get endpoints
        chunk_index = None
        endpoints = []
        if scan_id in scans and scans[scan_id].get("chunk_status"):
            for i, chunk in enumerate(scans[scan_id]["chunk_status"]):
                if chunk["chunk_id"] == chunk_id:
                    chunk_index = i
                    endpoints = chunk.get("endpoints", [])
                    break
        
        if chunk_index is None or not endpoints:
            return
            
        # Simulate scanning endpoints one by one
        total_endpoints = len(endpoints)
        if total_endpoints == 0:
            return
            
        # Time to spend on each endpoint (adjust based on RPS and endpoint complexity)
        time_per_endpoint = max(2, 15 / total_endpoints)  # Min 2s, max ~4s per endpoint
        
        for ep_index, endpoint in enumerate(endpoints):
            if process.returncode is not None:
                break  # Process completed
                
            # Update current endpoint being scanned
            if scan_id in scans and chunk_index < len(scans[scan_id]["chunk_status"]):
                scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = endpoint
                
                # Calculate progress based on endpoints completed
                progress = int((ep_index / total_endpoints) * 100)
                scans[scan_id]["chunk_status"][chunk_index]["progress"] = progress
                
                # Update overall scan progress
                update_overall_progress(scan_id)
                
                print(f"Chunk {chunk_id} scanning endpoint: {endpoint} ({progress}%)")
                
            await asyncio.sleep(time_per_endpoint)
            
            if process.returncode is not None:
                break  # Process completed during sleep
                
        # Final endpoint processing
        if process.returncode is None:
            if scan_id in scans and chunk_index < len(scans[scan_id]["chunk_status"]):
                scans[scan_id]["chunk_status"][chunk_index]["progress"] = 95
                scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = "Finalizing..."
                update_overall_progress(scan_id)
                
    except asyncio.CancelledError:
        # Set final progress when monitoring is cancelled (scan completed)
        if scan_id in scans and chunk_index is not None and chunk_index < len(scans[scan_id]["chunk_status"]):
            scans[scan_id]["chunk_status"][chunk_index]["progress"] = 100
            scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = None
            update_overall_progress(scan_id)
        raise


def update_overall_progress(scan_id: str):
    """Update overall scan progress based on chunk progress"""
    if scan_id not in scans:
        return
        
    scan = scans[scan_id]
    chunk_status = scan.get("chunk_status", [])
    
    if not chunk_status:
        return
        
    # Calculate average progress across all chunks
    total_progress = sum(chunk.get("progress", 0) for chunk in chunk_status)
    avg_chunk_progress = total_progress / len(chunk_status)
    
    # Map chunk progress to overall progress (30% base + 50% for scanning + 20% for final processing)
    scan_progress = 30 + int(avg_chunk_progress * 0.5)  # 30-80% range for scanning
    scan_progress = min(scan_progress, 80)  # Cap at 80% until final processing
    
    scan["progress"] = scan_progress
    print(f"Overall scan progress: {scan_progress}% (avg chunk: {avg_chunk_progress}%)")


async def run_scanner(scan_id: str, spec_location: str, request: ScanRequest):
    """Run the scanner with parallel endpoint processing"""
    try:
        scans[scan_id]["status"] = "running"
        scans[scan_id]["current_phase"] = "Analyzing API specification"
        scans[scan_id]["progress"] = 10
        
        # Convert localhost/127.0.0.1 to host.docker.internal for container access
        scanner_server_url = request.server_url
        if request.server_url.startswith(('http://localhost:', 'http://127.0.0.1:')):
            scanner_server_url = request.server_url.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')
        
        # Load and split the spec
        if spec_location.startswith('/shared/specs/'):
            with open(spec_location) as f:
                spec_content = f.read()
        else:
            # This shouldn't happen with our current setup, but handle it
            spec_content = spec_location
        
        # Split spec into chunks (4 endpoints per chunk for optimal parallelism)
        spec_chunks = split_openapi_spec_by_endpoints(spec_content, chunk_size=4)
        
        # Update scan with chunk information
        scans[scan_id]["total_chunks"] = len(spec_chunks)
        scans[scan_id]["parallel_mode"] = len(spec_chunks) > 1
        scans[scan_id]["progress"] = 20
        
        # If only one chunk, run normally
        if len(spec_chunks) == 1:
            print("Single chunk detected, running normal scan")
            # Run single scanner container
            chunk_result = await run_single_scanner_chunk(scan_id, spec_location, scanner_server_url, request, scan_id)
            if chunk_result["success"]:
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
                scans[scan_id]["status"] = "failed"
                scans[scan_id]["error"] = chunk_result.get("error", "Unknown error")
        else:
            print(f"Running parallel scan with {len(spec_chunks)} chunks")
            scans[scan_id]["current_phase"] = f"Running parallel scans ({len(spec_chunks)} containers)"
            scans[scan_id]["progress"] = 30
            
            # Initialize chunk status tracking
            chunk_status = []
            for i in range(len(spec_chunks)):
                chunk_spec = yaml.safe_load(spec_chunks[i])
                endpoints = list(chunk_spec.get('paths', {}).keys())
                chunk_status.append({
                    "chunk_id": f"{scan_id}_chunk_{i}",
                    "status": "preparing",
                    "endpoints_count": len(endpoints),
                    "endpoints": endpoints,
                    "current_endpoint": None,
                    "progress": 0
                })
            scans[scan_id]["chunk_status"] = chunk_status
            
            # Save chunk specs and run scanners in parallel
            chunk_tasks = []
            for i, chunk_spec in enumerate(spec_chunks):
                chunk_id = f"{scan_id}_chunk_{i}"
                
                # Update chunk status
                scans[scan_id]["chunk_status"][i]["status"] = "starting"
                
                # Save chunk spec
                chunk_path = SHARED_SPECS / f"{chunk_id}_spec.yaml"
                with open(chunk_path, 'w') as f:
                    f.write(chunk_spec)
                
                # Create scanner task
                task = run_single_scanner_chunk(chunk_id, f"/shared/specs/{chunk_id}_spec.yaml", scanner_server_url, request, scan_id)
                chunk_tasks.append(task)
            
            # Update status to show scanners are running
            for i in range(len(spec_chunks)):
                scans[scan_id]["chunk_status"][i]["status"] = "running"
                scans[scan_id]["chunk_status"][i]["progress"] = 0
            
            # Wait for all scanners to complete
            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            
            # Check results and update chunk status
            scans[scan_id]["current_phase"] = "Processing results"
            scans[scan_id]["progress"] = 80
            
            successful_chunks = 0
            failed_chunks = []
            for i, result in enumerate(chunk_results):
                if isinstance(result, Exception):
                    failed_chunks.append(f"Exception: {result}")
                    scans[scan_id]["chunk_status"][i]["status"] = "failed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                    scans[scan_id]["chunk_status"][i]["error"] = str(result)
                elif result.get("success"):
                    successful_chunks += 1
                    scans[scan_id]["chunk_status"][i]["status"] = "completed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                else:
                    failed_chunks.append(result.get("error", "Unknown error"))
                    scans[scan_id]["chunk_status"][i]["status"] = "failed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                    scans[scan_id]["chunk_status"][i]["error"] = result.get("error", "Unknown error")
            
            scans[scan_id]["completed_chunks"] = successful_chunks
            scans[scan_id]["current_phase"] = "Merging findings"
            scans[scan_id]["progress"] = 90
            
            # Merge results from all chunks
            merge_result = merge_scan_findings(scan_id, len(spec_chunks))
            
            scans[scan_id]["findings_count"] = merge_result["total_findings"]
            scans[scan_id]["status"] = "completed"
            scans[scan_id]["progress"] = 100
            scans[scan_id]["current_phase"] = "Scan completed"
            scans[scan_id]["completed_at"] = datetime.now()
            
            if failed_chunks:
                print(f"Some chunks failed: {failed_chunks}")
                scans[scan_id]["warnings"] = f"{len(failed_chunks)} chunks failed"
            
    except Exception as e:
        print(f"Scanner execution failed: {e}")
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


@app.get("/api/debug/url-conversion")
async def test_url_conversion(server_url: str):
    """Test endpoint to debug URL conversion logic"""
    original_url = server_url
    converted_url = server_url
    
    if server_url.startswith(('http://localhost:', 'http://127.0.0.1:')):
        converted_url = server_url.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')
    
    is_internal = converted_url.startswith('http://host.docker.internal:')
    
    return {
        "original_url": original_url,
        "converted_url": converted_url,
        "is_internal": is_internal,
        "will_use_scanner_network": is_internal,
        "will_use_host_network": not is_internal
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)