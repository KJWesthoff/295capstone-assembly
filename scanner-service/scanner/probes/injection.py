import re
from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score
from scanner.core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

ERROR_PATTERNS = [
    r"SQL syntax", r"SQLSTATE", r"ORA-\d{5}", r"mysql_", r"PDOException",
    r"MongoError", r"Traceback \(most recent call last\)", r"System\.InvalidOperationException",
    r"ReferenceError", r"TypeError", r"stack trace"
]
ERR_RE = re.compile("|".join(ERROR_PATTERNS), re.IGNORECASE)

FUZZ = [
    "' OR '1'='1", "\" OR \"1\"=\"1", "')--",
    "../../etc/passwd",
    "<script>alert(1)</script>",
    "<?xml version='1.0'?><!DOCTYPE a [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><a>&xxe;</a>"
]

def _looks_error(text: str|None) -> bool:
    if not text: return False
    return bool(ERR_RE.search(text[:4000]))

async def check_injection(client, spec, dangerous: bool=False):
    findings = []
    targets = [e for e in spec.endpoints if e.method == "GET"]
    if dangerous:
        targets += [e for e in spec.endpoints if e.method in ("POST","PUT","PATCH")]

    server_base = spec.servers[0] if getattr(spec, "servers", None) else ""

    for ep in targets[:50]:
        url = server_base.rstrip("/") + ep.path

        # Query fuzz
        for payload in FUZZ[:4]:
            r = await client.request(ep.method, url, params={"q": payload})
            if _looks_error(getattr(r, "text", "")):
                s, sev = score("API8")

                # Capture structured evidence
                request = capture_request_details(
                    method=ep.method,
                    url=url,
                    headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                    params={"q": payload}
                )

                response = capture_response_details(r)

                evidence_obj = capture_evidence(
                    request=request,
                    response=response,
                    auth_context="Public endpoint (no authentication required)",
                    probe_name="Injection Testing (Query Parameter)",
                    why_vulnerable=f"The endpoint {ep.path} reflects the query parameter 'q' into error messages without proper sanitization or parameterization. The payload '{payload}' triggered an error-like response containing patterns like SQL syntax errors, database exceptions, or stack traces, indicating the input is being processed unsafely.",
                    attack_scenario=(
                        "An attacker can submit malicious payloads in the 'q' query parameter to: "
                        "(1) Extract sensitive data from the database via SQL injection, "
                        "(2) Execute arbitrary commands on the server, "
                        "(3) Read sensitive files from the filesystem, or "
                        "(4) Bypass authentication/authorization checks. "
                        "Error messages leak internal implementation details that aid further exploitation."
                    ),
                    steps=[
                        f"Send {ep.method} request to {url} with query parameter q={payload}",
                        f"Observe: Response contains error-like patterns (status {r.status_code})",
                        "Refine the payload to execute SQL commands (UNION SELECT, etc.)",
                        "Extract data from database tables or execute OS commands",
                        "Expected secure behavior: Input should be parameterized/escaped, errors should not leak implementation details"
                    ],
                    poc_references=get_default_poc_references("API8")
                )

                findings.append(Finding(
                    rule="API8",
                    title=RULES["API8"],
                    endpoint=ep.path,
                    method=ep.method,
                    description="Possible injection via query param (error-like output observed).",
                    severity=sev,
                    score=s,
                    evidence=evidence_obj.model_dump()
                ))
                break

        # Header fuzz
        r = await client.request(ep.method, url, headers={"User-Agent": FUZZ[0]})
        if _looks_error(getattr(r, "text", "")):
            s, sev = score("API8")

            request = capture_request_details(
                method=ep.method,
                url=url,
                headers={"User-Agent": FUZZ[0]}
            )

            response = capture_response_details(r)

            evidence_obj = capture_evidence(
                request=request,
                response=response,
                auth_context="Public endpoint (no authentication required)",
                probe_name="Injection Testing (HTTP Header)",
                why_vulnerable=f"The endpoint {ep.path} processes the User-Agent header unsafely, triggering error-like responses when malicious payloads are included. The payload '{FUZZ[0]}' caused the application to leak error details, indicating insufficient input validation on HTTP headers.",
                attack_scenario=(
                    "An attacker can inject malicious payloads into HTTP headers (User-Agent, Referer, X-Forwarded-For, etc.) to: "
                    "(1) Execute SQL injection if headers are logged to databases, "
                    "(2) Exploit template injection in logging systems, "
                    "(3) Cause XSS when headers are reflected in admin dashboards, or "
                    "(4) Trigger buffer overflows in parsing code. "
                    "This is particularly dangerous as headers are often trusted and not sanitized."
                ),
                steps=[
                    f"Send {ep.method} request to {url}",
                    f"Include malicious User-Agent header: {FUZZ[0]}",
                    f"Observe: Response contains error patterns (status {r.status_code})",
                    "Test other headers (Referer, X-Forwarded-For, Cookie) with injection payloads",
                    "Expected secure behavior: All HTTP headers should be sanitized before processing/logging"
                ],
                poc_references=get_default_poc_references("API8")
            )

            findings.append(Finding(
                rule="API8",
                title=RULES["API8"],
                endpoint=ep.path,
                method=ep.method,
                description="Possible injection via header (error-like output observed).",
                severity=sev,
                score=s,
                evidence=evidence_obj.model_dump()
            ))

        # Body fuzz (dangerous only)
        if dangerous and ep.method in ("POST","PUT","PATCH"):
            r = await client.request(ep.method, url, json={"name": FUZZ[1]})
            if _looks_error(getattr(r, "text", "")):
                s, sev = score("API8")

                request = capture_request_details(
                    method=ep.method,
                    url=url,
                    headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                    body={"name": FUZZ[1]}
                )

                response = capture_response_details(r)

                evidence_obj = capture_evidence(
                    request=request,
                    response=response,
                    auth_context="Public endpoint (no authentication required)",
                    probe_name="Injection Testing (JSON Body)",
                    why_vulnerable=f"The endpoint {ep.path} accepts JSON input but does not properly sanitize or parameterize the 'name' field. The payload '{FUZZ[1]}' triggered error-like responses, indicating that JSON values are processed unsafely in database queries or system commands.",
                    attack_scenario=(
                        "An attacker can inject malicious payloads into JSON request bodies to: "
                        "(1) Execute SQL injection via POST/PUT/PATCH operations, "
                        "(2) Perform NoSQL injection in MongoDB or similar databases, "
                        "(3) Execute server-side template injection (SSTI), or "
                        "(4) Trigger XXE attacks if JSON is converted to XML internally. "
                        "This is particularly dangerous for create/update endpoints that write to databases."
                    ),
                    steps=[
                        f"Send {ep.method} request to {url}",
                        f"Include JSON body with malicious payload in 'name' field: {FUZZ[1]}",
                        f"Observe: Response contains error patterns (status {r.status_code})",
                        "Test other JSON fields with SQL/NoSQL injection payloads",
                        "Attempt to extract data using UNION SELECT or equivalent",
                        "Expected secure behavior: All JSON input should be validated and parameterized"
                    ],
                    poc_references=get_default_poc_references("API8")
                )

                findings.append(Finding(
                    rule="API8",
                    title=RULES["API8"],
                    endpoint=ep.path,
                    method=ep.method,
                    description="Possible injection via JSON body (error-like output observed).",
                    severity=sev,
                    score=s,
                    evidence=evidence_obj.model_dump()
                ))
    return findings
