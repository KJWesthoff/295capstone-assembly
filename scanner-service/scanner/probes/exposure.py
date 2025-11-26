
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response
from ..core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

SENSITIVE_HINTS = {"password","token","secret","apiKey","ssn","dob","email"}

async def run(spec, client, authctx, server_base: str) -> List[Finding]:
    findings: List[Finding] = []
    get_eps = [e for e in spec.endpoints if e.method == "GET"]
    for ep in get_eps[:50]:
        url = server_base.rstrip("/") + ep.path
        r = await client.request("GET", url)
        if r.status_code in (200,206):
            try:
                data = r.json()
            except Exception:
                data = None
            keys = set()
            def collect(d):
                if isinstance(d, dict):
                    for k,v in d.items():
                        keys.add(str(k))
                        collect(v)
                elif isinstance(d, list):
                    for i in d:
                        collect(i)
            if data is not None:
                collect(data)
                hints = sorted(k for k in keys if any(h.lower() in k.lower() for h in SENSITIVE_HINTS))
                if hints:
                    s, sev = score("API3")

                    # Capture structured evidence
                    request = capture_request_details(
                        method=ep.method,
                        url=url,
                        headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                        params={},
                        body=None
                    )

                    response_obj = capture_response_details(r)

                    evidence_obj = capture_evidence(
                        request=request,
                        response=response_obj,
                        auth_context=f"Testing endpoint {ep.path} for excessive data exposure",
                        probe_name="Excessive Data Exposure (API3)",
                        why_vulnerable=f"Response contains {len(hints)} potentially sensitive field(s): {', '.join(hints[:5])}. These fields may expose sensitive user data without proper filtering or access controls.",
                        attack_scenario="Attacker makes a normal GET request and receives response containing sensitive fields that should be filtered based on user permissions or redacted entirely.",
                        steps=[
                            f"Send GET request to {ep.path}",
                            "Receive 200 OK response with JSON data",
                            f"Observe response contains sensitive fields: {', '.join(hints[:3])}{'...' if len(hints) > 3 else ''}",
                            "Attacker can access sensitive data they shouldn't have permission to view"
                        ],
                        poc_references=get_default_poc_references("API3")
                    )

                    findings.append(Finding(
                        rule="API3", title=RULES["API3"], severity=sev, score=s,
                        endpoint=ep.path, method=ep.method,
                        description="Live response includes sensitive-looking fields.",
                        evidence=evidence_obj.model_dump()
                    ))
    return findings
