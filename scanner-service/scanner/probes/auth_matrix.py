
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from ..core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)
import base64

async def run(spec, client, authctx, server_base: str, fuzz_auth: bool) -> List[Finding]:
    findings: List[Finding] = []
    get_eps = [e for e in spec.endpoints if e.method in ("GET","HEAD")]

    for ep in get_eps:
        url = server_base.rstrip("/") + ep.path
        r_none = await client.request("GET", url)
        r_bogus = await client.request("GET", url, headers={"Authorization":"Bearer invalid.invalid.invalid"})
        if fuzz_auth:
            token = base64.b64encode(b"admin:admin").decode()
            r_basic = await client.request("GET", url, headers={"Authorization": f"Basic {token}"})
        else:
            r_basic = None
        candidates = [r for r in (r_none, r_bogus, r_basic) if r is not None]
        if any(r.status_code in (200,206) for r in candidates):
            s, sev = score("API2")

            # Use the first successful response for evidence (prefer unauthenticated)
            evidence_response = r_none if r_none.status_code in (200,206) else (r_bogus if r_bogus.status_code in (200,206) else r_basic)

            # Capture structured evidence
            request = capture_request_details(
                method=ep.method,
                url=url,
                headers=dict(evidence_response.request.headers) if hasattr(evidence_response, 'request') else {}
            )

            response = capture_response_details(evidence_response)

            # Determine which auth methods succeeded
            succeeded_methods = []
            if r_none.status_code in (200,206):
                succeeded_methods.append("No authentication")
            if r_bogus.status_code in (200,206):
                succeeded_methods.append("Invalid Bearer token")
            if r_basic and r_basic.status_code in (200,206):
                succeeded_methods.append("Basic auth (admin:admin)")

            auth_methods_str = ", ".join(succeeded_methods)

            evidence_obj = capture_evidence(
                request=request,
                response=response,
                auth_context=f"Tested with: {auth_methods_str}",
                probe_name="Broken Authentication Testing",
                why_vulnerable=f"The endpoint {ep.path} returns HTTP {evidence_response.status_code} (success) when accessed with invalid or no authentication credentials. The API does not properly enforce authentication requirements, allowing unauthorized access to potentially sensitive functionality and data. Specifically succeeded with: {auth_methods_str}.",
                attack_scenario=(
                    f"An attacker can access {ep.path} without valid credentials by: "
                    "(1) Making requests without any authentication headers, "
                    "(2) Using invalid/expired tokens, or "
                    "(3) Using default/guessed credentials. "
                    "This allows complete bypass of authentication controls, enabling unauthorized access to user data, "
                    "administrative functions, or sensitive business logic. The attacker can enumerate all endpoints "
                    "and access resources that should require valid authentication."
                ),
                steps=[
                    f"Send {ep.method} request to {url} without authentication headers",
                    f"Observe: Response returns HTTP {evidence_response.status_code} (success)",
                    "Try with invalid Bearer token: Authorization: Bearer invalid.invalid.invalid",
                    "Try with default Basic auth: Authorization: Basic YWRtaW46YWRtaW4= (admin:admin)",
                    "Enumerate all endpoints and access sensitive data/functions without valid credentials",
                    "Expected secure behavior: Endpoint should return HTTP 401 Unauthorized without valid authentication"
                ],
                poc_references=get_default_poc_references("API2"),
                additional_requests=[
                    {
                        "description": "Unauthenticated request",
                        "url": url,
                        "status": r_none.status_code,
                        "note": "Succeeded" if r_none.status_code in (200,206) else "Failed"
                    },
                    {
                        "description": "Invalid Bearer token",
                        "url": url,
                        "status": r_bogus.status_code,
                        "note": "Succeeded" if r_bogus.status_code in (200,206) else "Failed"
                    }
                ] + ([{
                    "description": "Basic auth with default credentials (admin:admin)",
                    "url": url,
                    "status": r_basic.status_code,
                    "note": "Succeeded" if r_basic.status_code in (200,206) else "Failed"
                }] if r_basic else [])
            )

            findings.append(Finding(
                rule="API2", title=RULES["API2"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description=f"Endpoint returns success with invalid/no authentication. Successful methods: {auth_methods_str}",
                evidence=evidence_obj.model_dump()
            ))
    return findings
