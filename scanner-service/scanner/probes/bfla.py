
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
    admin_eps = [e for e in spec.endpoints if ("admin" in "/".join([e.path]+e.tags).lower())]
    for ep in admin_eps:
        url = server_base.rstrip("/") + ep.path
        r = await client.request(ep.method, url)
        if r.status_code in (200,201,202,204):
            s, sev = score("API5")

            # Capture structured evidence
            request = capture_request_details(
                method=ep.method,
                url=url,
                headers=dict(r.request.headers) if hasattr(r, 'request') else {}
            )

            response = capture_response_details(r)

            # Determine auth context
            auth_desc = "No authentication provided" if not authctx.schemes else "Low-privilege credentials"
            if authctx.schemes:
                scheme_names = ", ".join(authctx.schemes.keys())
                auth_desc = f"Unauthenticated/low-privilege request ({scheme_names} available but not enforced)"

            evidence_obj = capture_evidence(
                request=request,
                response=response,
                auth_context=auth_desc,
                probe_name="BFLA (Broken Function Level Authorization)",
                why_vulnerable=f"The endpoint {ep.path} is tagged or named as an 'admin' function but returned HTTP {r.status_code} (success) without requiring administrative credentials. The API does not enforce role-based access control (RBAC) at the function level, allowing unauthorized users to access privileged functionality.",
                attack_scenario=(
                    "An attacker with low-privilege or no credentials can access administrative functions by: "
                    f"(1) Discovering admin endpoints through API documentation or path enumeration, "
                    f"(2) Calling {ep.method} {ep.path} directly without admin credentials, "
                    "(3) Executing privileged operations like creating admin users, deleting resources, modifying configurations, or accessing sensitive system data. "
                    "This allows complete compromise of the application's security model."
                ),
                steps=[
                    "Identify endpoints with 'admin', 'internal', or 'privileged' in path or tags",
                    f"Send {ep.method} request to {url} without admin credentials",
                    f"Observe: Response returns HTTP {r.status_code} (success)",
                    "Execute administrative operations (create users, delete data, etc.)",
                    "Expected secure behavior: Endpoint should return HTTP 403 Forbidden without valid admin credentials"
                ],
                poc_references=get_default_poc_references("API5")
            )

            findings.append(Finding(
                rule="API5", title=RULES["API5"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Admin-tagged endpoint succeeded without proper authorization; confirmed BFLA vulnerability.",
                evidence=evidence_obj.model_dump()
            ))
    return findings
