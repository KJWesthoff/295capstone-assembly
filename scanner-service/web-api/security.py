"""
Security utilities and middleware for VentiAPI Scanner
"""
import os
import jwt
import bcrypt
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from pathlib import Path
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import re

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Security bearer token
security = HTTPBearer()

class SecurityConfig:
    # File upload restrictions
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = {'.yml', '.yaml', '.json'}
    ALLOWED_MIME_TYPES = {'application/x-yaml', 'text/yaml', 'application/json', 'text/plain'}
    
    # Scan restrictions
    MAX_CONCURRENT_SCANS = 5
    MAX_ENDPOINTS_PER_SCAN = 100
    ALLOWED_PROTOCOLS = {'http', 'https'}
    
    # Docker restrictions
    DOCKER_MEMORY_LIMIT = '512m'
    DOCKER_CPU_LIMIT = '0.5'
    DOCKER_NETWORK_MODE = 'bridge'  # Allow network access for localhost scanning
    
    # Path restrictions
    SAFE_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9_\-./]+$')

class UserDB:
    """Simple user database - replace with proper DB in production"""
    def __init__(self):
        self.users: Dict[str, Dict] = {}
        # Create default admin user
        self.create_user("admin", "admin123", is_admin=True)
    
    def create_user(self, username: str, password: str, is_admin: bool = False) -> bool:
        if username in self.users:
            return False
        
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        self.users[username] = {
            'password_hash': password_hash,
            'is_admin': is_admin,
            'created_at': datetime.utcnow(),
            'scan_count': 0,
            'last_login': None
        }
        return True
    
    def verify_user(self, username: str, password: str) -> Optional[Dict]:
        if username not in self.users:
            return None
        
        user = self.users[username]
        if bcrypt.checkpw(password.encode(), user['password_hash']):
            user['last_login'] = datetime.utcnow()
            return {
                'username': username,
                'is_admin': user['is_admin'],
                'scan_count': user['scan_count']
            }
        return None

# Global user database instance
user_db = UserDB()

def create_access_token(username: str, is_admin: bool = False) -> str:
    """Create JWT access token"""
    payload = {
        'sub': username,
        'is_admin': is_admin,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        'iat': datetime.utcnow(),
        'jti': secrets.token_urlsafe(16)  # Token ID for revocation
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Verify JWT token and return user info"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get('sub')
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Check if user still exists
        if username not in user_db.users:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists"
            )
        
        return {
            'username': username,
            'is_admin': payload.get('is_admin', False),
            'exp': payload.get('exp')
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except (jwt.InvalidTokenError, jwt.DecodeError, jwt.InvalidSignatureError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def require_admin(user: Dict = Depends(verify_token)) -> Dict:
    """Require admin privileges"""
    if not user.get('is_admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user

def validate_file_upload(file_content: bytes, filename: str) -> None:
    """Validate uploaded file for security"""
    # Check file size
    if len(file_content) > SecurityConfig.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {SecurityConfig.MAX_FILE_SIZE} bytes"
        )
    
    # Check file extension
    file_ext = Path(filename).suffix.lower()
    if file_ext not in SecurityConfig.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension {file_ext} not allowed"
        )
    
    # Check for malicious content
    content_str = file_content.decode('utf-8', errors='ignore')
    
    # Block dangerous YAML/JSON constructs
    dangerous_patterns = [
        r'!!python/',  # Python object instantiation
        r'!!map:',     # YAML mapping attacks
        r'__import__', # Python imports
        r'eval\s*\(',  # Code evaluation
        r'exec\s*\(',  # Code execution
        r'<script',    # XSS attempts
        r'javascript:', # JavaScript URLs
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, content_str, re.IGNORECASE):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File contains potentially dangerous content"
            )

def validate_url(url: str, allow_localhost: bool = False) -> str:
    """Validate and sanitize URL input"""
    if not url or len(url) > 2048:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL length"
        )
    
    # Basic URL validation
    url_pattern = r'^https?://[a-zA-Z0-9.-]+(?:\:[0-9]+)?(?:/[a-zA-Z0-9._~:/?#[\]@!$&\'()*+,;=-]*)?$'
    if not re.match(url_pattern, url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL format"
        )
    
    # Block internal/private IP ranges (unless explicitly allowed)
    if not allow_localhost:
        internal_patterns = [
            r'://localhost',
            r'://127\.',
            r'://10\.',
            r'://192\.168\.',
            r'://172\.(1[6-9]|2[0-9]|3[0-1])\.',
            r'://169\.254\.',  # Link-local
            r'://0\.',         # Invalid range
        ]
        
        for pattern in internal_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot scan internal/private IP addresses"
                )
    
    return url

def sanitize_path(path: str) -> Path:
    """Sanitize file path to prevent directory traversal"""
    if not SecurityConfig.SAFE_PATH_PATTERN.match(path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters in path"
        )
    
    # Resolve path and check it's within allowed directory
    safe_path = Path(path).resolve()
    
    # Block directory traversal
    if '..' in str(safe_path) or str(safe_path).startswith('/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal not allowed"
        )
    
    return safe_path

def get_secure_docker_command(image: str, scan_id: str, spec_path: str, server_url: str, 
                            dangerous: bool = False, is_admin: bool = False) -> List[str]:
    """Generate secure Docker command with restrictions"""
    
    # Validate inputs
    if not re.match(r'^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$', image):
        raise ValueError("Invalid Docker image name")
    
    if not re.match(r'^[a-zA-Z0-9-_]+$', scan_id):
        raise ValueError("Invalid scan ID format")
    
    # Replace localhost with host.docker.internal for container access
    if 'localhost' in server_url or '127.0.0.1' in server_url:
        server_url = server_url.replace('localhost', 'host.docker.internal')
        server_url = server_url.replace('127.0.0.1', 'host.docker.internal')
    
    # Base security restrictions
    cmd = [
        'docker', 'run',
        '--rm',
        '--network', SecurityConfig.DOCKER_NETWORK_MODE,
        '--memory', SecurityConfig.DOCKER_MEMORY_LIMIT,
        '--cpus', SecurityConfig.DOCKER_CPU_LIMIT,
        '--tmpfs', '/tmp:noexec,nosuid,size=100m',  # Temp directory
        '--security-opt', 'no-new-privileges',  # Prevent privilege escalation
        '--user', '1000:1000',  # Run as non-root user
        '--cap-drop', 'ALL',  # Drop all capabilities
        '--cap-add', 'NET_RAW',  # Only allow network scanning
        '-v', 'scannerapp_shared-results:/shared/results',  # Mount results volume
        '-v', 'scannerapp_shared-specs:/shared/specs',      # Mount specs volume
        f'--name', f'scanner-{scan_id}',
        f'--label', f'scan_id={scan_id}',
        f'--label', 'app=ventiapi-scanner',
        image
    ]
    
    # Add scan parameters
    cmd.extend([
        '--spec', spec_path,
        '--server', server_url,
        '--out', f'/shared/results/{scan_id}',
        '--rps', '1.0',  # Limited rate
        '--max-requests', '100'  # Limited requests
    ])
    
    if dangerous and is_admin:  # Only admins can run dangerous scans
        cmd.append('--dangerous')
    
    return cmd

def hash_sensitive_data(data: str) -> str:
    """Hash sensitive data for logging/storage"""
    return hashlib.sha256(data.encode()).hexdigest()[:16]

class SecurityHeaders:
    """Security headers middleware"""
    
    @staticmethod
    def add_security_headers(response):
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy - Allow FastAPI docs CDN resources
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "connect-src 'self'"
        )
        
        # Remove server identification
        if "server" in response.headers:
            del response.headers["server"]
        
        return response

# Rate limit configurations
class RateLimits:
    LOGIN = "5/minute"
    SCAN_START = "10/hour"
    SCAN_STATUS = "60/minute"
    FILE_UPLOAD = "20/hour"
    GENERAL = "100/minute"

# Input validation schemas
def validate_scan_params(rps: float, max_requests: int) -> None:
    """Validate scan parameters"""
    if not 0.1 <= rps <= 2.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RPS must be between 0.1 and 2.0"
        )
    
    if not 1 <= max_requests <= 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Max requests must be between 1 and 500"
        )

def log_security_event(event_type: str, user: Optional[str], details: Dict):
    """Log security events for monitoring"""
    timestamp = datetime.utcnow().isoformat()
    event = {
        'timestamp': timestamp,
        'type': event_type,
        'user': user,
        'ip': details.get('ip', 'unknown'),
        'user_agent': hash_sensitive_data(details.get('user_agent', '')),
        'details': details
    }
    
    # In production, send to proper logging system (ELK, Splunk, etc.)
    print(f"SECURITY_EVENT: {event}")