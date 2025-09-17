"""
Secure version of VentiAPI Scanner Web API
Implements comprehensive security measures
"""
import asyncio
import json
import uuid
import os
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import subprocess
import re
import shutil
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Import our security module
from security import (
    verify_token, require_admin, user_db, create_access_token,
    validate_file_upload, validate_url, sanitize_path, 
    get_secure_docker_command, get_railway_scanner_command, SecurityHeaders, limiter,
    RateLimits, validate_scan_params, log_security_event,
    SecurityConfig
)

# Import plugin system
try:
    from plugin_api import plugin_router
    PLUGIN_SYSTEM_AVAILABLE = True
except ImportError as e:
    print(f"Plugin system not available: {e}")
    PLUGIN_SYSTEM_AVAILABLE = False





def get_allowed_origins():
    """Get allowed CORS origins based on environment"""
    # Default development origins
    origins = [
        "http://localhost:3000",
        "http://localhost:3001"
    ]
    
    # Add production origins from environment variables
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url)
    
    # Add additional origins from comma-separated env var
    additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS")
    if additional_origins:
        origins.extend([origin.strip() for origin in additional_origins.split(",")])
    
    return origins

# Create FastAPI app with security configuration
app = FastAPI(
    title="VentiAPI Scanner Web API (Secure)",
    version="2.0.0",
    docs_url="/api/docs",  # Docs accessible via ALB routing
    redoc_url=None,    # Disable redoc
    openapi_url="/api/openapi.json"
)

# Add rate limiting
app.state.limiter = limiter

# Include plugin router if available
if PLUGIN_SYSTEM_AVAILABLE:
    app.include_router(plugin_router)
    print("✅ Plugin system enabled - containerized scanners available at /api/v2/*")
else:
    print("⚠️ Plugin system disabled - using legacy scanner implementation only")

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    return SecurityHeaders.add_security_headers(response)

# Enhanced CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),  # Dynamic based on environment
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],  # Limited methods
    allow_headers=["Authorization", "Content-Type"],  # Limited headers
    max_age=600,  # Cache preflight for 10 minutes
)

# Mount static files for Railway deployment (frontend) - but not at root yet
static_path = Path("static")
static_files_app = None
if static_path.exists():
    static_files_app = StaticFiles(directory="static", html=True)

# Secure storage (use Redis/DB in production)
scans: Dict[str, dict] = {}
user_sessions: Dict[str, dict] = {}

# Secure paths
SHARED_RESULTS = Path("/shared/results")
SHARED_SPECS = Path("/shared/specs")

# Ensure directories exist with proper permissions
SHARED_RESULTS.mkdir(parents=True, exist_ok=True, mode=0o700)
SHARED_SPECS.mkdir(parents=True, exist_ok=True, mode=0o700)

# OpenAPI spec sanitization and processing functions
def sanitize_openapi_spec(spec_content: str) -> str:
    """Sanitize OpenAPI spec to improve vulnerability detection compatibility"""
    try:
        spec = yaml.safe_load(spec_content)
        
        print(f"Sanitizing OpenAPI spec with {len(spec.get('paths', {}))} endpoints")
        
        # Remove complex security schemes that may interfere with vulnerability testing
        if 'components' in spec and 'securitySchemes' in spec['components']:
            # Keep basic auth schemes but remove complex ones
            security_schemes = spec['components']['securitySchemes']
            cleaned_schemes = {}
            
            for scheme_name, scheme_def in security_schemes.items():
                if isinstance(scheme_def, dict):
                    scheme_type = scheme_def.get('type', '').lower()
                    # Keep simple schemes, remove complex ones
                    if scheme_type in ['http', 'apikey']:
                        cleaned_schemes[scheme_name] = {
                            'type': scheme_type,
                            'scheme': scheme_def.get('scheme', 'bearer') if scheme_type == 'http' else None
                        }
                        # Remove custom extensions that might confuse the scanner
                        if 'scheme' in cleaned_schemes[scheme_name] and cleaned_schemes[scheme_name]['scheme'] is None:
                            del cleaned_schemes[scheme_name]['scheme']
            
            spec['components']['securitySchemes'] = cleaned_schemes
            print(f"Cleaned security schemes: {list(cleaned_schemes.keys())}")
        
        # Simplify path-level security requirements
        if 'paths' in spec:
            for path, path_item in spec['paths'].items():
                if isinstance(path_item, dict):
                    for method, operation in path_item.items():
                        if isinstance(operation, dict) and 'security' in operation:
                            # Remove complex security requirements for better vulnerability testing
                            # The scanner will test both authenticated and unauthenticated access
                            print(f"Removing security requirement from {method.upper()} {path}")
                            del operation['security']
        
        # Remove global security requirements that might prevent vulnerability testing
        if 'security' in spec:
            print("Removing global security requirements")
            del spec['security']
        
        # Simplify server URLs to use the target URL
        if 'servers' in spec and len(spec['servers']) > 0:
            # Keep only the first server or use a generic placeholder
            first_server = spec['servers'][0]
            if isinstance(first_server, dict):
                # Remove server variables that might cause URL resolution issues
                if 'variables' in first_server:
                    del first_server['variables']
                spec['servers'] = [first_server]
                print(f"Simplified servers to: {first_server.get('url', 'unknown')}")
        
        # Remove complex parameter schemas that might interfere with fuzzing
        if 'paths' in spec:
            for path, path_item in spec['paths'].items():
                if isinstance(path_item, dict):
                    for method, operation in path_item.items():
                        if isinstance(operation, dict):
                            # Simplify parameters
                            if 'parameters' in operation:
                                simplified_params = []
                                for param in operation['parameters']:
                                    if isinstance(param, dict):
                                        # Keep essential parameter info, remove complex schemas
                                        simple_param = {
                                            'name': param.get('name'),
                                            'in': param.get('in'),
                                            'required': param.get('required', False)
                                        }
                                        # Add basic schema if present
                                        if 'schema' in param and isinstance(param['schema'], dict):
                                            param_type = param['schema'].get('type', 'string')
                                            simple_param['schema'] = {'type': param_type}
                                        simplified_params.append(simple_param)
                                operation['parameters'] = simplified_params
                            
                            # Simplify request body schemas
                            if 'requestBody' in operation:
                                req_body = operation['requestBody']
                                if isinstance(req_body, dict) and 'content' in req_body:
                                    # Keep content types but simplify schemas
                                    for content_type, content_def in req_body['content'].items():
                                        if isinstance(content_def, dict) and 'schema' in content_def:
                                            # Replace complex schemas with simple object type
                                            content_def['schema'] = {'type': 'object'}
        
        sanitized_content = yaml.dump(spec, default_flow_style=False)
        print(f"Spec sanitization complete. Original: {len(spec_content)} chars, Sanitized: {len(sanitized_content)} chars")
        return sanitized_content
        
    except Exception as e:
        print(f"Spec sanitization failed: {e}, using original spec")
        return spec_content

# Parallel scanning functions
def split_openapi_spec_by_endpoints(spec_content: str, chunk_size: int = 4) -> List[str]:
    """Split OpenAPI spec into chunks of endpoints for parallel processing"""
    try:
        spec = yaml.safe_load(spec_content)
        
        if 'paths' not in spec:
            print("No paths found in spec, using original")
            return [spec_content]
        
        path_items = list(spec['paths'].items())
        
        # If we have fewer paths than chunk_size, just return the original spec
        if len(path_items) <= chunk_size:
            return [spec_content]
        
        # Split paths into chunks
        chunks = []
        for i in range(0, len(path_items), chunk_size):
            chunk_paths = dict(path_items[i:i+chunk_size])
            
            # Create a new spec with just this chunk of paths
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
            try:
                with open(findings_file) as f:
                    chunk_findings = json.load(f)
                    merged_findings.extend(chunk_findings)
                total_processed += 1
            except Exception as e:
                print(f"Failed to read findings from chunk {i}: {e}")
    
    # Save merged findings
    merged_dir = SHARED_RESULTS / scan_id
    merged_dir.mkdir(parents=True, exist_ok=True)
    
    merged_findings_file = merged_dir / "findings.json"
    with open(merged_findings_file, 'w') as f:
        json.dump(merged_findings, f, indent=2)
    
    print(f"Merged {len(merged_findings)} findings from {total_processed}/{num_chunks} chunks")
    
    return {
        "findings": merged_findings,
        "chunks_processed": total_processed,
        "chunks_expected": num_chunks
    }

async def run_single_scanner_chunk(chunk_id: str, spec_location: str, scanner_server_url: str, scan_id: str, user: Dict):
    """Run a single scanner container for one chunk of endpoints with progress monitoring"""
    try:
        # Check if Docker is available
        docker_available = shutil.which('docker') is not None
        
        if docker_available:
            # Local Docker execution
            print(f"Starting local Docker scanner: {chunk_id}")
            
            # Build secure Docker command for this chunk
            cmd = get_secure_docker_command(
                image="ventiapi-scanner/scanner:latest",
                scan_id=chunk_id,  # Use chunk_id for container naming
                spec_path=spec_location,
                server_url=scanner_server_url,
                dangerous=user.get("is_admin", False),  # Only admins can run dangerous scans
                is_admin=user.get("is_admin", False)
            )
            
            print(f"DEBUG: Docker command: {' '.join(cmd)}")
        else:
            # Railway-compatible direct execution
            print(f"Starting Railway-compatible scanner: {chunk_id}")
            
            # Build Railway scanner command
            cmd = get_railway_scanner_command(
                scan_id=chunk_id,
                spec_path=spec_location,
                server_url=scanner_server_url,
                dangerous=user.get("is_admin", False),
                is_admin=user.get("is_admin", False)
            )
            
            print(f"DEBUG: Railway command: {' '.join(cmd)}")
        
        # Execute with timeout
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/app/scanner" if not docker_available else None,  # Set working directory for Railway
            env={**os.environ, "PYTHONPATH": "/app/scanner"} if not docker_available else None
        )
        
        # Start progress monitoring for this chunk
        monitor_task = asyncio.create_task(monitor_chunk_progress(chunk_id, scan_id, process))
        
        # Wait with timeout (reduced to 8 minutes per chunk)
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=480)
            
            # Cancel progress monitoring
            monitor_task.cancel()
            
            if process.returncode == 0:
                print(f"Chunk {chunk_id} completed successfully")
                return {"success": True, "chunk_id": chunk_id}
            else:
                error_msg = stderr.decode()[:200] if stderr else "Unknown error"
                print(f"Chunk {chunk_id} failed: {error_msg}")
                return {"success": False, "chunk_id": chunk_id, "error": error_msg}
                
        except asyncio.TimeoutError:
            monitor_task.cancel()
            process.kill()
            error_msg = "Chunk timed out after 8 minutes"
            print(f"Chunk {chunk_id} timed out")
            return {"success": False, "chunk_id": chunk_id, "error": error_msg}
            
    except Exception as e:
        error_msg = str(e)[:200]
        print(f"Exception in chunk {chunk_id}: {error_msg}")
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
            print(f"Could not find chunk {chunk_id} in scan data")
            return
        
        # Simulate scanning each endpoint
        for endpoint_idx, endpoint in enumerate(endpoints):
            # Check if process is still running
            if process.returncode is not None:
                break
                
            # Calculate progress (0-95% range for endpoint scanning)
            progress = int((endpoint_idx / len(endpoints)) * 95)
            
            # Update chunk status
            if scan_id in scans and chunk_index < len(scans[scan_id]["chunk_status"]):
                scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = endpoint
                scans[scan_id]["chunk_status"][chunk_index]["progress"] = progress
                
                # Update overall scan progress
                update_overall_scan_progress(scan_id)
                
                print(f"Chunk {chunk_id} scanning endpoint: {endpoint} ({progress}%)")
            
            # Wait before next endpoint (simulate scan time)
            await asyncio.sleep(5)
        
        # Final update for this chunk
        if process.returncode is None:
            if scan_id in scans and chunk_index < len(scans[scan_id]["chunk_status"]):
                scans[scan_id]["chunk_status"][chunk_index]["progress"] = 95
                scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = "Finalizing..."
        
        # Wait for process completion or timeout
        await asyncio.sleep(5)
        
        # Final progress update
        if scan_id in scans and chunk_index is not None and chunk_index < len(scans[scan_id]["chunk_status"]):
            scans[scan_id]["chunk_status"][chunk_index]["progress"] = 100
            scans[scan_id]["chunk_status"][chunk_index]["current_endpoint"] = None
            update_overall_scan_progress(scan_id)
        
    except asyncio.CancelledError:
        # Progress monitoring was cancelled (chunk completed/failed)
        pass
    except Exception as e:
        print(f"Error in chunk progress monitoring: {e}")

def update_overall_scan_progress(scan_id: str):
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
    
    scan["progress"] = min(scan_progress, 80)  # Cap at 80% until completion
    
    print(f"Overall scan progress: {scan_progress}% (avg chunk: {avg_chunk_progress}%)")

# Pydantic models
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)

class ScanRequest(BaseModel):
    server_url: str = Field(..., max_length=2048)
    target_url: Optional[str] = Field(None, max_length=2048)
    rps: float = Field(1.0, ge=0.1, le=2.0)
    max_requests: int = Field(100, ge=1, le=500)
    dangerous: bool = Field(False)
    fuzz_auth: bool = Field(False)

class UserResponse(BaseModel):
    username: str
    is_admin: bool
    scan_count: int

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Authentication endpoints
@app.post("/api/auth/login", response_model=LoginResponse)
@limiter.limit(RateLimits.LOGIN)
async def login(request: Request, login_data: LoginRequest):
    """Secure login endpoint with rate limiting"""
    
    # Log login attempt
    log_security_event("login_attempt", login_data.username, {
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent", "")
    })
    
    # Verify credentials
    user = user_db.verify_user(login_data.username, login_data.password)
    if not user:
        # Log failed login
        log_security_event("login_failed", login_data.username, {
            "ip": request.client.host,
            "reason": "invalid_credentials"
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create access token
    access_token = create_access_token(user['username'], user['is_admin'])
    
    # Log successful login
    log_security_event("login_success", user['username'], {
        "ip": request.client.host,
        "is_admin": user['is_admin']
    })
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user)
    )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user(user: Dict = Depends(verify_token)):
    """Get current user information"""
    user_data = user_db.users.get(user['username'])
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        username=user['username'],
        is_admin=user['is_admin'],
        scan_count=user_data['scan_count']
    )

# Secure scan endpoints
@app.post("/api/scan/start")
@limiter.limit(RateLimits.SCAN_START)
async def start_scan(
    request: Request,
    target_url: str = Form(...),
    scanner_type: str = Form("venti-api"),
    max_requests: int = Form(100),
    requests_per_second: float = Form(1.0),
    dangerous_mode: bool = Form(False),
    fuzz_auth: bool = Form(False),
    spec_file: Optional[UploadFile] = File(None),
    user: Dict = Depends(verify_token)
):
    """Start a scan using the plugin system with VentiAPI as default"""
    
    # Rate limit per user
    if PLUGIN_SYSTEM_AVAILABLE:
        try:
            from scanner_plugins.manager import scanner_manager
            current_scans = len(scanner_manager.get_active_scans(user['username']))
        except:
            current_scans = 0
    else:
        current_scans = len([s for s in scans.values() 
                            if s.get('user') == user['username'] and s.get('status') in ['pending', 'running']])
    
    if current_scans >= SecurityConfig.MAX_CONCURRENT_SCANS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Maximum {SecurityConfig.MAX_CONCURRENT_SCANS} concurrent scans allowed"
        )
    
    # Try plugin system first
    if PLUGIN_SYSTEM_AVAILABLE:
        try:
            from scanner_plugins.manager import scanner_manager
            from scanner_plugins.base import ScanTarget, ScanConfig, ScannerType
            
            # Validate inputs
            allow_localhost = user.get('is_admin', False)
            target_url = validate_url(target_url, allow_localhost=allow_localhost)
            
            # Validate scanner type
            try:
                scanner_enum = ScannerType(scanner_type)
            except ValueError:
                # Default to venti-api if invalid scanner type
                scanner_enum = ScannerType.VENTI_API
            
            # Check if scanner is available, fall back to venti-api
            scanner = scanner_manager.get_scanner(scanner_enum)
            if not scanner:
                scanner_enum = ScannerType.VENTI_API
                scanner = scanner_manager.get_scanner(scanner_enum)
            
            # Only admins can run dangerous scans
            if dangerous_mode and not user.get('is_admin'):
                raise HTTPException(status_code=403, detail="Admin privileges required for dangerous scans")
            
            # Handle spec file
            spec_file_path = None
            if spec_file:
                file_content = await spec_file.read()
                validate_file_upload(file_content, spec_file.filename)
                
                from pathlib import Path
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
            scan_id = str(uuid.uuid4())
            
            # Log security event
            log_security_event("scan_started", user['username'], {
                "scan_id": scan_id,
                "ip": request.client.host,
                "target_url": target_url[:50] + "..." if len(target_url) > 50 else target_url,
                "scanner_type": scanner_type,
                "dangerous": dangerous_mode
            })
            
            # Start scan asynchronously
            asyncio.create_task(
                scanner_manager.start_scan(
                    scan_id=scan_id,
                    target=target,
                    config=config,
                    scanner_type=scanner_enum,
                    user_info=user
                )
            )
            
            # Update user scan count
            user_db.users[user['username']]['scan_count'] += 1
            
            return {
                "scan_id": scan_id,
                "status": "pending",
                "scanner_type": scanner_type,
                "target_url": target_url
            }
            
        except Exception as e:
            print(f"Plugin system failed, falling back to legacy: {e}")
    
    # Fallback to legacy scan implementation
    return await start_legacy_scan(
        request=request,
        target_url=target_url,
        rps=requests_per_second,
        max_requests=max_requests,
        dangerous=dangerous_mode,
        fuzz_auth=fuzz_auth,
        spec_file=spec_file,
        user=user
    )

async def start_legacy_scan(
    request: Request,
    target_url: str,
    rps: float = 1.0,
    max_requests: int = 100,
    dangerous: bool = False,
    fuzz_auth: bool = False,
    spec_file: Optional[UploadFile] = None,
    user: Dict = None
):
    """Legacy scan implementation fallback"""
    
    scan_id = str(uuid.uuid4())
    
    # Validate inputs (admin users can scan localhost for development)
    allow_localhost = user.get('is_admin', False)
    target_url = validate_url(target_url, allow_localhost=allow_localhost)
    
    validate_scan_params(rps, max_requests)
    
    # Only admins can run dangerous scans
    if dangerous and not user.get('is_admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for dangerous scans"
        )
    
    # Handle spec file
    spec_location = None
    if spec_file:
        # Validate file
        file_content = await spec_file.read()
        validate_file_upload(file_content, spec_file.filename)
        
        # Save securely
        safe_filename = f"{scan_id}_{spec_file.filename}"
        
        # Local environment, save to shared volume
        spec_path = SHARED_SPECS / safe_filename
        with open(spec_path, "wb") as f:
            f.write(file_content)
        
        # Set permissions for scanner user (1000:1000)
        spec_path.chmod(0o644)  # Allow group/other read access
        # Change ownership to match scanner container user
        import subprocess
        subprocess.run(['chown', '1000:1000', str(spec_path)], check=False)
        spec_location = f"/shared/specs/{safe_filename}"
    
    # Create scan record
    scans[scan_id] = {
        "scan_id": scan_id,
        "status": "pending",
        "progress": 0,
        "current_phase": "initializing",
        "user": user['username'],
        "server_url": target_url,
        "target_url": target_url,
        "spec_location": spec_location,
        "dangerous": dangerous,
        "created_at": datetime.utcnow().isoformat(),
        "findings_count": 0,
        "parallel_mode": False,  # Single container scan for secure mode
        "total_chunks": 1,
        "completed_chunks": 0,
        "chunk_status": []
    }
    
    # Log security event
    log_security_event("scan_started", user['username'], {
        "scan_id": scan_id,
        "ip": request.client.host,
        "server_url": target_url[:50] + "..." if len(target_url) > 50 else target_url,
        "dangerous": dangerous
    })
    
    # Start scan asynchronously (implement your scanning logic here)
    asyncio.create_task(execute_secure_scan(scan_id, user))
    
    # Update user scan count
    user_db.users[user['username']]['scan_count'] += 1
    
    return {"scan_id": scan_id, "status": "pending"}

async def execute_secure_scan(scan_id: str, user: Dict):
    """Execute scan with security restrictions and parallel processing"""
    try:
        scan_data = scans[scan_id]
        scan_data["status"] = "running"
        scan_data["current_phase"] = "Initializing scan"
        scan_data["progress"] = 5
        
        # Pre-create output directory to avoid permission issues
        result_dir = SHARED_RESULTS / scan_id
        result_dir.mkdir(parents=True, exist_ok=True, mode=0o755)
        # Set proper ownership for scanner user (1000:1000)
        import subprocess
        subprocess.run(['chown', '-R', '1000:1000', str(result_dir)], check=False)
        
        # Get scanner server URL and spec location
        scanner_server_url = scan_data["server_url"]
        spec_location = scan_data["spec_location"]
        
        if not spec_location:
            # No spec file provided, run single container scan
            scan_data["current_phase"] = "Starting single container scan"
            scan_data["progress"] = 10
            scan_data["parallel_mode"] = False
            scan_data["total_chunks"] = 1
            
            # Check if Docker is available
            docker_available = shutil.which('docker') is not None
            
            if docker_available:
                # Local Docker execution
                print(f"Starting local Docker scanner: {scan_id}")
                
                # Run single container scan
                cmd = get_secure_docker_command(
                    image="ventiapi-scanner/scanner:latest",
                    scan_id=scan_id,
                    spec_path=scanner_server_url + "/openapi.json",  # Use OpenAPI spec endpoint
                    server_url=scanner_server_url,
                    dangerous=scan_data["dangerous"],
                    is_admin=user.get("is_admin", False)
                )
                
                print(f"DEBUG: Single container Docker command: {' '.join(cmd)}")
            else:
                # Railway-compatible direct execution
                print(f"Starting Railway-compatible single scanner: {scan_id}")
                
                # Run single Railway scan
                cmd = get_railway_scanner_command(
                    scan_id=scan_id,
                    spec_path=scanner_server_url + "/openapi.json",  # Use OpenAPI spec endpoint
                    server_url=scanner_server_url,
                    dangerous=scan_data["dangerous"],
                    is_admin=user.get("is_admin", False)
                )
                
                print(f"DEBUG: Single container Railway command: {' '.join(cmd)}")
            
            # Execute single scan
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/app/scanner" if not docker_available else None,  # Set working directory for Railway
                env={**os.environ, "PYTHONPATH": "/app/scanner"} if not docker_available else None
            )
            
            # Start progress monitoring
            progress_task = asyncio.create_task(monitor_scan_progress(scan_id))
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=600)
                progress_task.cancel()
                
                if process.returncode == 0:
                    scan_data["status"] = "completed"
                    scan_data["progress"] = 100
                    scan_data["current_phase"] = "Scan completed"
                    scan_data["completed_at"] = datetime.utcnow().isoformat()
                    scan_data["completed_chunks"] = 1
                    
                    # Count findings
                    findings_file = SHARED_RESULTS / scan_id / "findings.json"
                    if findings_file.exists():
                        with open(findings_file) as f:
                            findings = json.load(f)
                            scan_data["findings_count"] = len(findings)
                    
                    log_security_event("scan_completed", user['username'], {
                        "scan_id": scan_id,
                        "findings_count": scan_data["findings_count"]
                    })
                else:
                    scan_data["status"] = "failed"
                    scan_data["error"] = f"Scan execution failed: {stderr.decode()[:200]}"
                    scan_data["progress"] = 100
                    scan_data["current_phase"] = "Scan failed"
                    
                    log_security_event("scan_failed", user['username'], {
                        "scan_id": scan_id,
                        "error": stderr.decode()[:200]
                    })
                    
            except asyncio.TimeoutError:
                progress_task.cancel()
                process.kill()
                scan_data["status"] = "failed"
                scan_data["error"] = "Scan timed out after 10 minutes"
                scan_data["progress"] = 100
                scan_data["current_phase"] = "Scan timed out"
                
                log_security_event("scan_timeout", user['username'], {"scan_id": scan_id})
            
            return
        
        # We have a spec file - check if we should use parallel processing
        scan_data["current_phase"] = "Analyzing OpenAPI specification"
        scan_data["progress"] = 10
        
        # Read the spec file (local only)
        with open(spec_location.replace("/shared/specs/", str(SHARED_SPECS) + "/")) as f:
            spec_content = f.read()
        
        # Sanitize and split spec into chunks (4 endpoints per chunk for optimal parallelism)
        if spec_content:
            # Sanitize the spec to improve vulnerability detection
            sanitized_spec_content = sanitize_openapi_spec(spec_content)
            spec_chunks = split_openapi_spec_by_endpoints(sanitized_spec_content, chunk_size=2)  # More containers, smaller chunks
            
            # Local file - save sanitized version
            original_filename = os.path.basename(spec_location)
            sanitized_filename = original_filename.replace('.yaml', '_sanitized.yaml').replace('.yml', '_sanitized.yml').replace('.json', '_sanitized.json')
            if sanitized_filename == original_filename:  # No extension found, add suffix
                sanitized_filename = f"{original_filename}_sanitized.yaml"
            sanitized_spec_path = SHARED_SPECS / sanitized_filename
            with open(sanitized_spec_path, 'w') as f:
                f.write(sanitized_spec_content)
            sanitized_spec_path.chmod(0o644)
            import subprocess
            subprocess.run(['chown', '1000:1000', str(sanitized_spec_path)], check=False)
            # Update spec location to point to sanitized version
            spec_location = f"/shared/specs/{sanitized_filename}"
            scan_data["spec_location"] = spec_location
            print(f"Saved sanitized spec to: {spec_location}")
        else:
            # Fallback to single chunk mode if can't read spec
            spec_chunks = [scan_id]  # Single chunk with scan_id as identifier
        
        # Update scan with chunk information
        scans[scan_id]["total_chunks"] = len(spec_chunks)
        scans[scan_id]["parallel_mode"] = len(spec_chunks) > 1
        
        scan_data["current_phase"] = "Preparing scan execution"
        scan_data["progress"] = 20
        
        # If only one chunk, run normally
        if len(spec_chunks) == 1:
            print("Single chunk detected, running normal scan")
            scan_data["current_phase"] = "Running single container scan"
            scan_data["progress"] = 30
            
            chunk_result = await run_single_scanner_chunk(scan_id, spec_location, scanner_server_url, scan_id, user)
            if chunk_result["success"]:
                scan_data["status"] = "completed"
                scan_data["progress"] = 100
                scan_data["current_phase"] = "Scan completed"
                scan_data["completed_at"] = datetime.utcnow().isoformat()
                scan_data["completed_chunks"] = 1
                
                # Count findings
                findings_file = SHARED_RESULTS / scan_id / "findings.json"
                if findings_file.exists():
                    with open(findings_file) as f:
                        findings = json.load(f)
                        scan_data["findings_count"] = len(findings)
                
                log_security_event("scan_completed", user['username'], {
                    "scan_id": scan_id,
                    "findings_count": scan_data["findings_count"]
                })
            else:
                scan_data["status"] = "failed"
                scan_data["error"] = chunk_result.get("error", "Unknown error")
                scan_data["progress"] = 100
                scan_data["current_phase"] = "Scan failed"
                
                log_security_event("scan_failed", user['username'], {
                    "scan_id": scan_id,
                    "error": chunk_result.get("error", "Unknown error")[:200]
                })
        else:
            # Multiple chunks - run parallel scan
            print(f"Running parallel scan with {len(spec_chunks)} chunks")
            scan_data["current_phase"] = f"Running parallel scans ({len(spec_chunks)} containers)"
            scan_data["progress"] = 30
            
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
                    "progress": 0,
                    "error": None
                })
            
            scans[scan_id]["chunk_status"] = chunk_status
            
            # Save chunk specs and run scanners in parallel
            chunk_tasks = []
            for i, chunk_spec in enumerate(spec_chunks):
                chunk_id = f"{scan_id}_chunk_{i}"
                
                # Pre-create chunk output directory
                chunk_result_dir = SHARED_RESULTS / chunk_id
                chunk_result_dir.mkdir(parents=True, exist_ok=True, mode=0o755)
                # Set proper ownership for scanner user (1000:1000)
                subprocess.run(['chown', '-R', '1000:1000', str(chunk_result_dir)], check=False)
                
                # Update chunk status
                scans[scan_id]["chunk_status"][i]["status"] = "starting"
                
                # Local mode, save to shared volume
                chunk_path = SHARED_SPECS / f"{chunk_id}_spec.yaml"
                with open(chunk_path, 'w') as f:
                    f.write(chunk_spec)
                
                # Set proper permissions
                chunk_path.chmod(0o644)
                subprocess.run(['chown', '1000:1000', str(chunk_path)], check=False)
                chunk_spec_location = f"/shared/specs/{chunk_id}_spec.yaml"
                
                task = run_single_scanner_chunk(chunk_id, chunk_spec_location, scanner_server_url, scan_id, user)
                chunk_tasks.append(task)
            
            # Update all chunks to running status
            for i in range(len(spec_chunks)):
                scans[scan_id]["chunk_status"][i]["status"] = "running"
                scans[scan_id]["chunk_status"][i]["progress"] = 0
            
            # Wait for all chunks to complete
            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            
            # Check results and update chunk status
            scan_data["current_phase"] = "Processing parallel scan results"
            scan_data["progress"] = 85
            
            successful_chunks = 0
            failed_chunks = []
            for i, result in enumerate(chunk_results):
                if isinstance(result, Exception):
                    failed_chunks.append(f"Exception: {result}")
                    scans[scan_id]["chunk_status"][i]["status"] = "failed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                    scans[scan_id]["chunk_status"][i]["error"] = str(result)
                elif result["success"]:
                    successful_chunks += 1
                    scans[scan_id]["chunk_status"][i]["status"] = "completed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                else:
                    failed_chunks.append(result.get("error", "Unknown error"))
                    scans[scan_id]["chunk_status"][i]["status"] = "failed"
                    scans[scan_id]["chunk_status"][i]["progress"] = 100
                    scans[scan_id]["chunk_status"][i]["error"] = result.get("error", "Unknown error")
            
            scans[scan_id]["completed_chunks"] = successful_chunks
            
            scan_data["current_phase"] = "Merging scan results"
            scan_data["progress"] = 90
            
            # Merge results from all chunks
            merge_result = merge_scan_findings(scan_id, len(spec_chunks))
            
            scan_data["findings_count"] = len(merge_result["findings"])
            scan_data["status"] = "completed"
            scan_data["progress"] = 100
            scan_data["current_phase"] = "Scan completed"
            scan_data["completed_at"] = datetime.utcnow().isoformat()
            
            if failed_chunks:
                print(f"Some chunks failed: {failed_chunks}")
                scan_data["warnings"] = f"{len(failed_chunks)} chunks failed"
            
            log_security_event("scan_completed", user['username'], {
                "scan_id": scan_id,
                "findings_count": scan_data["findings_count"],
                "chunks_processed": successful_chunks,
                "chunks_total": len(spec_chunks)
            })
            
    except Exception as e:
        scan_data["status"] = "failed"
        scan_data["error"] = str(e)
        scan_data["progress"] = 100
        scan_data["current_phase"] = "Scan failed"
        
        log_security_event("scan_error", user['username'], {
            "scan_id": scan_id,
            "error": str(e)[:200]
        })

async def monitor_scan_progress(scan_id: str):
    """Monitor scan progress and update status periodically"""
    try:
        progress_values = [45, 50, 55, 60, 65, 70, 75, 80, 85]
        phase_messages = [
            "Testing authentication",
            "Scanning for injection vulnerabilities", 
            "Checking authorization controls",
            "Testing input validation",
            "Analyzing response patterns",
            "Testing business logic",
            "Checking for information disclosure",
            "Validating security headers",
            "Finalizing analysis"
        ]
        
        for i, (progress, phase) in enumerate(zip(progress_values, phase_messages)):
            if scan_id not in scans or scans[scan_id]["status"] != "running":
                break
                
            scans[scan_id]["progress"] = progress
            scans[scan_id]["current_phase"] = phase
            
            await asyncio.sleep(15)  # Update every 15 seconds
            
    except asyncio.CancelledError:
        # Progress monitoring was cancelled (scan completed/failed)
        pass
    except Exception as e:
        print(f"Error in progress monitoring: {e}")

@app.get("/api/scan/{scan_id}/status")
@limiter.limit(RateLimits.SCAN_STATUS)
async def get_scan_status(
    request: Request,
    scan_id: str,
    user: Dict = Depends(verify_token)
):
    """Get scan status using plugin system with fallback to legacy"""
    
    # Validate scan ID format
    if not re.match(r'^[a-zA-Z0-9-_]+$', scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    
    # Try plugin system first
    if PLUGIN_SYSTEM_AVAILABLE:
        try:
            from scanner_plugins.manager import scanner_manager
            
            scan_status = scanner_manager.get_scan_status(scan_id)
            
            if scan_status:
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
                    return {
                        "scan_id": scan_id,
                        "status": result.status,
                        "scanner_type": result.scanner_type.value,
                        "target_url": result.target.url,
                        "progress": 100 if result.status in ["completed", "failed"] else 50,
                        "findings_count": len(result.findings),
                        "started_at": result.started_at.isoformat(),
                        "completed_at": result.completed_at.isoformat() if result.completed_at else None,
                        "error_message": result.error_message,
                        "user": scan_status.get("user", {}).get("username", "unknown"),
                        "current_phase": "Completed" if result.status == "completed" else "Processing"
                    }
                else:
                    # Scan still running
                    return {
                        "scan_id": scan_id,
                        "status": status,
                        "scanner_type": scanner.scanner_type.value,
                        "target_url": target.url,
                        "progress": 25,  # Estimated progress
                        "findings_count": 0,
                        "started_at": scan_status["started_at"].isoformat(),
                        "user": scan_status.get("user", {}).get("username", "unknown"),
                        "current_phase": "Running scan"
                    }
        except Exception as e:
            print(f"Plugin system status check failed: {e}")
    
    # Fallback to legacy scan status
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    
    # Check ownership (admins can see all scans)
    if scan_data["user"] != user["username"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return scan_data

@app.get("/api/scan/{scan_id}/findings")
async def get_findings(
    scan_id: str,
    offset: int = 0,
    limit: int = 50,
    user: Dict = Depends(verify_token)
):
    """Get scan findings with pagination and ownership check"""
    
    # Validate scan ID format
    if not re.match(r'^[a-zA-Z0-9-_]+$', scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    
    # Check ownership
    if scan_data["user"] != user["username"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Read findings file (local only)
    all_findings = []
    
    findings_file = SHARED_RESULTS / scan_id / "findings.json"
    if not findings_file.exists():
        return {"findings": [], "total": 0}
    
    try:
        with open(findings_file) as f:
            all_findings = json.load(f)
    except Exception as e:
        print(f"Could not read local findings file: {e}")
        return {"findings": [], "total": 0}
    
    try:
        
        # Apply pagination
        total = len(all_findings)
        findings = all_findings[offset:offset + limit]
        
        response = {
            "findings": findings,
            "total": total
        }
        
        # Add nextOffset if there are more results
        if offset + limit < total:
            response["nextOffset"] = offset + limit
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read findings: {str(e)}"
        )

@app.get("/api/scan/{scan_id}/report")
async def get_report(
    scan_id: str,
    user: Dict = Depends(verify_token)
):
    """Download report with ownership check"""
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    
    # Check ownership
    if scan_data["user"] != user["username"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    report_path = SHARED_RESULTS / scan_id / "report.html"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Log access
    log_security_event("report_accessed", user['username'], {
        "scan_id": scan_id,
        "file": "report.html"
    })
    
    return FileResponse(
        path=report_path,
        filename=f"security_report_{scan_id}.html",
        media_type="text/html"
    )

@app.get("/api/scans")
@limiter.limit(RateLimits.GENERAL)
async def list_scans(request: Request, user: Dict = Depends(verify_token)):
    """List user's scans (admins see all)"""
    
    if user.get("is_admin"):
        return {"scans": list(scans.values())}
    else:
        user_scans = [scan for scan in scans.values() if scan["user"] == user["username"]]
        return {"scans": user_scans}

@app.delete("/api/scan/{scan_id}")
async def delete_scan(
    scan_id: str,
    user: Dict = Depends(verify_token)
):
    """Delete scan with ownership check"""
    
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan_data = scans[scan_id]
    
    # Check ownership
    if scan_data["user"] != user["username"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clean up files
    try:
        import shutil
        result_dir = SHARED_RESULTS / scan_id
        if result_dir.exists():
            shutil.rmtree(result_dir)
        
        # Clean up spec file if exists
        if scan_data.get("spec_location"):
            spec_file = Path(scan_data["spec_location"])
            if spec_file.exists():
                spec_file.unlink()
    except Exception as e:
        # Log but don't fail the deletion
        log_security_event("cleanup_error", user['username'], {
            "scan_id": scan_id,
            "error": str(e)
        })
    
    # Remove from memory
    del scans[scan_id]
    
    log_security_event("scan_deleted", user['username'], {"scan_id": scan_id})
    
    return {"message": "Scan deleted successfully"}

# Plugin System Endpoints (Merged from v2 API)
@app.get("/api/scanners")
async def get_available_scanners_plugin(user: Dict = Depends(verify_token)):
    """Get list of available scanner plugins and their capabilities"""
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to basic scanner info
        return {
            "scanners": [
                {
                    "type": "venti-api",
                    "name": "VentiAPI Scanner",
                    "capabilities": {
                        "description": "Comprehensive API security scanner",
                        "supported_targets": ["api"],
                        "supported_formats": ["openapi", "swagger"],
                        "parallel_capable": True,
                        "healthy": True
                    }
                }
            ],
            "total_count": 1
        }
    
    try:
        from scanner_plugins.manager import scanner_manager
        scanners = scanner_manager.get_available_scanners()
        
        # Add health status
        health_status = await scanner_manager.health_check_all()
        
        for scanner in scanners:
            scanner_type = scanner["type"]
            scanner["healthy"] = health_status.get(scanner_type, False)
        
        return {
            "scanners": scanners,
            "total_count": len(scanners)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting scanners: {str(e)}")

@app.post("/api/scan/start-plugin")
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
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to legacy scan
        return await start_scan(
            request=None,  # Will be handled by dependency injection
            server_url=target_url,
            target_url=target_url,
            rps=requests_per_second,
            max_requests=max_requests,
            dangerous=dangerous_mode,
            fuzz_auth=fuzz_auth,
            spec_file=spec_file,
            user=user
        )
    
    try:
        from scanner_plugins.manager import scanner_manager
        from scanner_plugins.base import ScanTarget, ScanConfig, ScannerType
        
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
            import uuid
            
            safe_filename = f"{uuid.uuid4()}_{spec_file.filename}"
            spec_path = SHARED_SPECS / safe_filename
            
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
        scan_id = str(uuid.uuid4())
        
        # Start scan asynchronously
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

@app.get("/api/scan/{scan_id}/status-plugin")
async def get_plugin_scan_status(scan_id: str, user: Dict = Depends(verify_token)):
    """Get status of a plugin-based scan with fallback to legacy"""
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to legacy status
        return await get_scan_status(None, scan_id, user)
    
    try:
        from scanner_plugins.manager import scanner_manager
        
        # Try plugin system first
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if scan_status:
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
                return {
                    "scan_id": scan_id,
                    "status": result.status,
                    "scanner_type": result.scanner_type.value,
                    "target_url": result.target.url,
                    "progress": 100 if result.status in ["completed", "failed"] else 50,
                    "findings_count": len(result.findings),
                    "started_at": result.started_at.isoformat(),
                    "completed_at": result.completed_at.isoformat() if result.completed_at else None,
                    "error_message": result.error_message
                }
            else:
                # Scan still running
                return {
                    "scan_id": scan_id,
                    "status": status,
                    "scanner_type": scanner.scanner_type.value,
                    "target_url": target.url,
                    "progress": 25,  # Estimated progress
                    "findings_count": 0,
                    "started_at": scan_status["started_at"].isoformat()
                }
        else:
            # Fallback to legacy scan status
            return await get_scan_status(None, scan_id, user)
    
    except HTTPException:
        raise
    except Exception as e:
        # Fallback to legacy scan status
        return await get_scan_status(None, scan_id, user)

@app.get("/api/scan/{scan_id}/findings-plugin")
async def get_plugin_scan_findings(
    scan_id: str,
    offset: int = 0,
    limit: int = 50,
    user: Dict = Depends(verify_token)
):
    """Get findings from a plugin-based scan with fallback to legacy"""
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to legacy findings
        return await get_findings(None, scan_id, offset, limit, user)
    
    try:
        from scanner_plugins.manager import scanner_manager
        
        # Try plugin system first
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if scan_status:
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
        else:
            # Fallback to legacy findings
            return await get_findings(None, scan_id, offset, limit, user)
        
    except HTTPException:
        raise
    except Exception as e:
        # Fallback to legacy findings
        return await get_findings(None, scan_id, offset, limit, user)

@app.delete("/api/scan/{scan_id}/stop-plugin")
async def stop_plugin_scan(scan_id: str, user: Dict = Depends(verify_token)):
    """Stop a plugin-based scan with fallback to legacy"""
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to legacy stop scan
        return await stop_scan(None, scan_id, user)
    
    try:
        from scanner_plugins.manager import scanner_manager
        
        # Try plugin system first
        scan_status = scanner_manager.get_scan_status(scan_id)
        
        if scan_status:
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
        else:
            # Fallback to legacy stop scan
            return await stop_scan(None, scan_id, user)
        
    except HTTPException:
        raise
    except Exception as e:
        # Fallback to legacy stop scan
        return await stop_scan(None, scan_id, user)

@app.get("/api/scans-plugin")
async def list_plugin_scans(user: Dict = Depends(verify_token)):
    """List scans from plugin system with fallback to legacy"""
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to legacy scan list
        return await list_scans(user)
    
    try:
        from scanner_plugins.manager import scanner_manager
        
        if user.get("is_admin"):
            scans = scanner_manager.get_active_scans()
        else:
            scans = scanner_manager.get_active_scans(user["username"])
        
        return {"scans": scans}
        
    except Exception as e:
        # Fallback to legacy scan list
        return await list_scans(user)

@app.get("/api/statistics-plugin")
async def get_scanner_statistics_plugin(admin_user: Dict = Depends(verify_token)):
    """Get scanner statistics from plugin system (admin only) with fallback"""
    
    if not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    if not PLUGIN_SYSTEM_AVAILABLE:
        # Fallback to basic stats
        return {
            "total_scans": 0,
            "scanner_types": {"venti-api": 1},
            "scanner_health": {"venti-api": True},
            "system_mode": "legacy"
        }
    
    try:
        from scanner_plugins.manager import scanner_manager
        
        stats = scanner_manager.get_scan_statistics()
        health_status = await scanner_manager.health_check_all()
        
        stats["scanner_health"] = health_status
        stats["system_mode"] = "plugin"
        
        return stats
        
    except Exception as e:
        # Fallback to basic stats
        return {
            "total_scans": 0,
            "scanner_types": {"venti-api": 1},
            "scanner_health": {"venti-api": True},
            "system_mode": "legacy",
            "error": str(e)
        }

# Admin endpoints
@app.get("/api/admin/users")
async def list_users(admin_user: Dict = Depends(require_admin)):
    """List all users (admin only)"""
    users = []
    for username, data in user_db.users.items():
        users.append({
            "username": username,
            "is_admin": data["is_admin"],
            "scan_count": data["scan_count"],
            "created_at": data["created_at"].isoformat(),
            "last_login": data["last_login"].isoformat() if data["last_login"] else None
        })
    return {"users": users}

@app.post("/api/admin/users")
async def create_user(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    is_admin: bool = Form(False),
    admin_user: Dict = Depends(require_admin)
):
    """Create new user (admin only)"""
    
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters, password at least 6"
        )
    
    if user_db.create_user(username, password, is_admin):
        log_security_event("user_created", admin_user['username'], {
            "new_user": username,
            "is_admin": is_admin,
            "ip": request.client.host
        })
        return {"message": "User created successfully"}
    else:
        raise HTTPException(status_code=400, detail="Username already exists")

# Health check endpoint (no auth required)
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    }

# Error handlers
@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc):
    """Handle rate limit exceeded"""
    log_security_event("rate_limit_exceeded", None, {
        "ip": request.client.host,
        "path": request.url.path,
        "user_agent": request.headers.get("user-agent", "")[:100]
    })
    
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."}
    )

# Mount static files at the end so API routes take precedence
if static_files_app is not None:
    app.mount("/", static_files_app, name="static")

if __name__ == "__main__":
    import uvicorn
    
    # Production security settings
    uvicorn.run(
        "main_secure:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        server_header=False,  # Hide server header
        date_header=False     # Hide date header
    )