
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

async def run(spec, client, authctx, server_base: str) -> List[Finding]:
    findings: List[Finding] = []
    id_endpoints = [e for e in spec.endpoints if e.method == "GET" and e.has_id_param]
    for ep in id_endpoints:
        url1 = ep.example_url(server_base, id=1)
        url2 = ep.example_url(server_base, id=2)
        r1 = await client.request("GET", url1)
        r2 = await client.request("GET", url2)
        if r1.status_code in (200,206) and r2.status_code in (200,206):
            s, sev = score("API1")

            # Capture structured evidence for the vulnerability
            # Use r2 as the primary evidence (accessing another user's data)
            request = capture_request_details(
                method="GET",
                url=url2,
                headers=dict(r2.request.headers) if hasattr(r2, 'request') else {}
            )

            response = capture_response_details(r2)

            # Determine auth context description
            auth_desc = "No authentication" if not authctx.schemes else "Unauthenticated request"
            if authctx.schemes:
                scheme_names = ", ".join(authctx.schemes.keys())
                auth_desc = f"Minimal authentication ({scheme_names})"

            evidence_obj = capture_evidence(
                request=request,
                response=response,
                auth_context=auth_desc,
                probe_name="BOLA (Broken Object Level Authorization)",
                why_vulnerable=f"The endpoint {ep.path} returns HTTP {r2.status_code} for object ID=2 without validating that the requester owns or is authorized to access this object. Both ID=1 and ID=2 returned successful responses, indicating the API does not check object ownership.",
                attack_scenario=(
                    "An attacker with minimal or no credentials can enumerate object IDs (1, 2, 3, ...) "
                    f"by making requests to {ep.path}. Each request reveals data belonging to different users/objects. "
                    "This allows unauthorized access to sensitive data, potentially exposing PII, financial records, "
                    "or confidential business information for all objects in the system."
                ),
                steps=[
                    "Obtain any valid authentication token (or no auth if endpoint is public)",
                    f"Send GET request to {url2}",
                    f"Observe: Response returns HTTP {r2.status_code} with object data",
                    "Repeat with different IDs (1, 3, 4, etc.) to enumerate all accessible objects",
                    "Expected secure behavior: API should return HTTP 403 Forbidden for objects not owned by the requester"
                ],
                poc_references=get_default_poc_references("API1"),
                additional_requests=[
                    {
                        "description": "First request (object ID=1)",
                        "url": url1,
                        "status": r1.status_code,
                        "note": "Also returned success, confirming the vulnerability"
                    }
                ]
            )

            findings.append(Finding(
                rule="API1", title=RULES["API1"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Two distinct object IDs returned success without proper authorization; confirmed IDOR/BOLA vulnerability.",
                evidence=evidence_obj.model_dump()  # Convert Pydantic model to dict for JSON serialization
            ))
    return findings
