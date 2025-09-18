
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response

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
            findings.append(Finding(
                rule="API6", title=RULES["API6"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Sent extra sensitive fields; server accepted/echoed them (possible mass assignment).",
                evidence={"request": payload, "response": summarize_response(r)}
            ))
    return findings
