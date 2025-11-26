"""
Evidence Capture System

Provides structured evidence capture for security findings, including:
- Full HTTP request/response pairs
- Authentication context
- Reproduction steps and curl commands
- Vulnerability analysis
- Proof-of-concept references
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from datetime import datetime
import json


class HttpRequest(BaseModel):
    """Complete HTTP request details"""
    method: str
    url: str
    headers: Dict[str, str]
    query_params: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    body_params: Optional[Dict[str, Any]] = None


class HttpResponse(BaseModel):
    """Complete HTTP response details"""
    status_code: int
    headers: Dict[str, str]
    body: str
    size_bytes: int
    time_ms: Optional[float] = None
    redirect_chain: Optional[List[str]] = None


class EvidenceCapture(BaseModel):
    """Structured evidence for a security finding"""
    # HTTP Transaction
    request: HttpRequest
    response: HttpResponse

    # Context
    auth_context: str
    probe_name: str
    timestamp: str

    # Reproduction
    curl_command: str
    steps: List[str]

    # Analysis
    why_vulnerable: str
    attack_scenario: str
    poc_references: List[str]

    # Optional additional data
    additional_requests: Optional[List[Dict[str, Any]]] = None


def capture_request_details(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    body: Optional[Any] = None
) -> HttpRequest:
    """
    Captures HTTP request details from client request

    Args:
        method: HTTP method (GET, POST, etc.)
        url: Full URL
        headers: Request headers dict
        params: Query parameters dict
        body: Request body (dict or string)

    Returns:
        HttpRequest object with all details
    """
    request_headers = headers or {}
    query_params = params or {}

    # Handle body serialization
    body_str = None
    body_params = None
    if body:
        if isinstance(body, dict):
            body_params = body
            body_str = json.dumps(body, indent=2)
        else:
            body_str = str(body)

    return HttpRequest(
        method=method,
        url=url,
        headers=request_headers,
        query_params=query_params if query_params else None,
        body=body_str,
        body_params=body_params
    )


def capture_response_details(response: Any) -> HttpResponse:
    """
    Captures HTTP response details from client response object

    Args:
        response: HTTP response object (from httpx or similar)

    Returns:
        HttpResponse object with all details
    """
    # Extract response body (limit to 100KB for storage)
    MAX_BODY_SIZE = 100 * 1024  # 100KB
    body_text = ""
    try:
        body_text = response.text or ""
        if len(body_text) > MAX_BODY_SIZE:
            body_text = (
                body_text[:MAX_BODY_SIZE] +
                f"\n\n[... truncated, original size: {len(body_text)} bytes]"
            )
    except Exception:
        body_text = "[Unable to decode response body]"

    # Extract headers (filter sensitive ones for evidence)
    headers_dict = dict(response.headers) if hasattr(response, 'headers') else {}

    # Get response timing if available
    time_ms = None
    if hasattr(response, 'elapsed'):
        time_ms = response.elapsed.total_seconds() * 1000

    return HttpResponse(
        status_code=response.status_code,
        headers=headers_dict,
        body=body_text,
        size_bytes=len(body_text),
        time_ms=time_ms,
        redirect_chain=None  # Can be populated if redirect info available
    )


def generate_curl_command(request: HttpRequest) -> str:
    """
    Generates a ready-to-run curl command from HttpRequest

    Args:
        request: HttpRequest object

    Returns:
        Formatted curl command string
    """
    parts = [f"curl -X {request.method}"]

    # Add URL (quote if contains spaces or special chars)
    parts.append(f"'{request.url}'")

    # Add headers
    for key, value in request.headers.items():
        # Skip sensitive headers in curl for safety
        if key.lower() in ['authorization', 'cookie', 'x-api-key']:
            parts.append(f"-H '{key}: [REDACTED]'")
        else:
            # Escape single quotes in value
            safe_value = value.replace("'", "'\\''")
            parts.append(f"-H '{key}: {safe_value}'")

    # Add request body if present
    if request.body:
        # Escape single quotes in body
        safe_body = request.body.replace("'", "'\\''")
        parts.append(f"-d '{safe_body}'")

    # Join with line continuation for readability
    return " \\\n  ".join(parts)


def capture_evidence(
    request: HttpRequest,
    response: HttpResponse,
    auth_context: str,
    probe_name: str,
    why_vulnerable: str,
    attack_scenario: str,
    steps: List[str],
    poc_references: Optional[List[str]] = None,
    additional_requests: Optional[List[Dict[str, Any]]] = None
) -> EvidenceCapture:
    """
    Creates a complete evidence package for a security finding

    Args:
        request: HttpRequest object
        response: HttpResponse object
        auth_context: Description of auth used (e.g., "user1@test.com (User role)")
        probe_name: Name of the security probe (e.g., "BOLA", "SQL Injection")
        why_vulnerable: Explanation of why this is vulnerable
        attack_scenario: Description of how attacker would exploit this
        steps: List of human-readable reproduction steps
        poc_references: Optional list of URLs to PoC resources
        additional_requests: Optional list of related requests for context

    Returns:
        EvidenceCapture object ready for JSON serialization
    """
    curl_cmd = generate_curl_command(request)
    refs = poc_references or []

    return EvidenceCapture(
        request=request,
        response=response,
        auth_context=auth_context,
        probe_name=probe_name,
        timestamp=datetime.utcnow().isoformat() + "Z",
        curl_command=curl_cmd,
        steps=steps,
        why_vulnerable=why_vulnerable,
        attack_scenario=attack_scenario,
        poc_references=refs,
        additional_requests=additional_requests
    )


def enhance_response_summary(response: Any, include_full_response: bool = True) -> Dict[str, Any]:
    """
    Enhanced version of summarize_response that captures full details

    This is a drop-in replacement for the existing summarize_response in common.py

    Args:
        response: HTTP response object
        include_full_response: If True, includes full response body (up to 100KB)

    Returns:
        Dict with enhanced response details
    """
    body_excerpt = None
    full_body = None

    try:
        text = response.text or ""
        body_excerpt = text[:200]

        if include_full_response:
            MAX_SIZE = 100 * 1024
            if len(text) > MAX_SIZE:
                full_body = text[:MAX_SIZE] + f"\n[... truncated from {len(text)} bytes]"
            else:
                full_body = text
    except Exception:
        body_excerpt = None
        full_body = "[Unable to decode response]"

    result = {
        "status": response.status_code,
        "headers": {
            k: v for k, v in response.headers.items()
            if k.lower() in (
                "content-type", "retry-after", "x-ratelimit-remaining",
                "x-ratelimit-limit", "content-length", "server"
            )
        },
        "len": getattr(response, "num_bytes_downloaded", len(response.text) if hasattr(response, 'text') else None),
        "excerpt": body_excerpt,
    }

    if include_full_response and full_body:
        result["full_body"] = full_body

    return result


# Default PoC reference collections by vulnerability type
DEFAULT_POC_REFERENCES = {
    "API1": [  # BOLA/IDOR
        "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
        "https://portswigger.net/web-security/access-control/idor",
    ],
    "API2": [  # Broken Authentication
        "https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/",
        "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    ],
    "API3": [  # Broken Object Property Level Authorization
        "https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/",
    ],
    "API4": [  # Unrestricted Resource Consumption
        "https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/",
    ],
    "API5": [  # BFLA
        "https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/",
    ],
    "API6": [  # Unrestricted Access to Sensitive Business Flows
        "https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/",
    ],
    "API7": [  # Server Side Request Forgery
        "https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/",
        "https://portswigger.net/web-security/ssrf",
    ],
    "API8": [  # Security Misconfiguration / Injection
        "https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/",
        "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
    ],
    "API9": [  # Improper Inventory Management
        "https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/",
    ],
    "API10": [  # Unsafe Consumption of APIs
        "https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/",
    ],
}


def get_default_poc_references(rule_id: str) -> List[str]:
    """
    Get default PoC reference URLs for a given vulnerability rule

    Args:
        rule_id: Vulnerability rule ID (e.g., "API1", "API5")

    Returns:
        List of relevant reference URLs
    """
    return DEFAULT_POC_REFERENCES.get(rule_id, [])
