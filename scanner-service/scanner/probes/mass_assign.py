
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

SENSITIVE_MUTABLE = {"role","isAdmin","ownerId","balance"}

async def run(spec, client, authctx, server_base: str, dangerous: bool=False) -> List[Finding]:
    findings: List[Finding] = []
    if not dangerous:
        return findings
    post_eps = [e for e in spec.endpoints if e.method in ("POST","PUT","PATCH")]
    for ep in post_eps[:25]:
        url = server_base.rstrip("/") + ep.path
        payload = {k: True for k in SENSITIVE_MUTABLE}
        r = await client.request(ep.method, url, json=payload)
        if r.status_code in (200,201,202):
            s, sev = score("API6")

            # Capture structured evidence
            request = capture_request_details(
                method=ep.method,
                url=url,
                headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                params={},
                body=payload
            )

            response_obj = capture_response_details(r)

            evidence_obj = capture_evidence(
                request=request,
                response=response_obj,
                auth_context=f"Testing mass assignment on {ep.path} with dangerous mode enabled",
                probe_name="Mass Assignment (API6)",
                why_vulnerable=f"API endpoint {ep.path} accepted {ep.method} request containing sensitive administrative fields ({', '.join(SENSITIVE_MUTABLE)}) without proper input filtering. Server responded with {r.status_code}, indicating it processed these unauthorized fields. This allows privilege escalation attacks.",
                attack_scenario="Attacker crafts request with extra parameters like 'role=admin', 'isAdmin=true', or 'balance=999999' in addition to legitimate fields. If API blindly binds all parameters to internal objects, attacker gains unauthorized privileges or manipulates critical data.",
                steps=[
                    f"Send {ep.method} request to {ep.path}",
                    f"Include sensitive fields in payload: {', '.join(list(SENSITIVE_MUTABLE)[:3])}",
                    f"Server accepts request with {r.status_code} status",
                    "Server processes unauthorized fields without validation",
                    "Attacker successfully escalates privileges or modifies protected attributes"
                ],
                poc_references=get_default_poc_references("API6")
            )

            findings.append(Finding(
                rule="API6", title=RULES["API6"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Sent extra sensitive fields; server accepted/echoed them (possible mass assignment).",
                evidence=evidence_obj.model_dump()
            ))
    return findings
