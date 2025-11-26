from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score
from scanner.core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

def _cors_issues(headers: dict) -> list:
    issues = []
    aco = headers.get("Access-Control-Allow-Origin")
    acc = headers.get("Access-Control-Allow-Credentials", "")
    if aco == "*" and acc.lower() == "true":
        issues.append("CORS allows any origin with credentials=true")
    return issues

def _hsts_missing(headers: dict, base_url: str) -> bool:
    if base_url.lower().startswith("https://"):
        return "Strict-Transport-Security" not in headers
    return False

async def check_misconfiguration(client, spec, server_base: str):
    findings = []

    # 1) Plain HTTP base URL (no TLS)
    if server_base.lower().startswith("http://"):
        s, sev = score("API7")

        # Capture structured evidence for HTTP (no TLS) finding
        request = capture_request_details(
            method="N/A",
            url=server_base,
            headers={},
            params={},
            body=None
        )

        evidence_obj = capture_evidence(
            request=request,
            response=None,
            auth_context="Configuration analysis - no request sent",
            probe_name="Security Misconfiguration (API7) - Missing TLS",
            why_vulnerable=f"API server is configured to accept connections over plaintext HTTP ({server_base}). All API traffic is transmitted unencrypted, exposing sensitive data (credentials, tokens, PII) to interception via man-in-the-middle attacks.",
            attack_scenario="Attacker performs network sniffing (packet capture) on shared network to intercept API requests/responses in plaintext. Can capture authentication tokens, session cookies, and sensitive user data.",
            steps=[
                f"Observe API server base URL: {server_base}",
                "Server accepts HTTP connections without TLS encryption",
                "Attacker positions on network path (WiFi, ISP, compromised router)",
                "Capture all API traffic in plaintext using tools like Wireshark",
                "Extract credentials, tokens, and sensitive data from captured packets"
            ],
            poc_references=get_default_poc_references("API7")
        )

        findings.append(Finding(
            rule="API7",
            title=RULES["API7"],
            endpoint="/",
            method="GET",
            description="Server base URL uses plaintext HTTP (no TLS).",
            severity=sev,
            score=s,
            evidence=evidence_obj.model_dump()
        ))

    # 2) CORS / HSTS check via preflight on a representative GET endpoint
    target = next((e for e in spec.endpoints if e.method == "GET"), None)
    if not target:
        return findings

    url = server_base.rstrip("/") + target.path
    r = await client.request(
        "OPTIONS",
        url,
        headers={
            "Origin": "https://scanner.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    cors_list = _cors_issues(r.headers)
    hsts = _hsts_missing(r.headers, server_base)

    if cors_list or hsts:
        s, sev = score("API7")

        # Capture structured evidence for CORS/HSTS misconfiguration
        request = capture_request_details(
            method="OPTIONS",
            url=url,
            headers={
                "Origin": "https://scanner.example",
                "Access-Control-Request-Method": "GET",
            },
            params={},
            body=None
        )

        response_obj = capture_response_details(r)

        issues_desc = []
        if cors_list:
            issues_desc.extend(cors_list)
        if hsts:
            issues_desc.append("Missing Strict-Transport-Security header on HTTPS endpoint")

        evidence_obj = capture_evidence(
            request=request,
            response=response_obj,
            auth_context=f"Testing CORS and security headers on {target.path}",
            probe_name="Security Misconfiguration (API7) - CORS/HSTS Issues",
            why_vulnerable=f"API has security misconfigurations: {'; '.join(issues_desc)}. Permissive CORS allows malicious websites to make authenticated requests from victim browsers. Missing HSTS allows protocol downgrade attacks.",
            attack_scenario="Attacker hosts malicious website that makes cross-origin requests to API using victim's credentials (cookies/tokens). If CORS is misconfigured, browser allows the request. Without HSTS, attacker can downgrade HTTPS connections to HTTP to intercept traffic.",
            steps=[
                f"Send OPTIONS preflight request to {target.path}",
                f"Observe response with status {r.status_code}",
                "Analyze CORS headers: " + (cors_list[0] if cors_list else "OK"),
                "Check HSTS header: " + ("Missing" if hsts else "Present"),
                "Misconfiguration allows cross-origin attacks or protocol downgrade"
            ],
            poc_references=get_default_poc_references("API7")
        )

        findings.append(Finding(
            rule="API7",
            title=RULES["API7"],
            endpoint=target.path,
            method="OPTIONS",
            description="Potential security misconfiguration (permissive CORS and/or missing HSTS).",
            severity=sev,
            score=s,
            evidence=evidence_obj.model_dump(),
        ))

    return findings
