
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response

async def run(spec, client, authctx, server_base: str) -> List[Finding]:
    findings: List[Finding] = []
    admin_eps = [e for e in spec.endpoints if ("admin" in "/".join([e.path]+e.tags).lower())]
    for ep in admin_eps:
        url = server_base.rstrip("/") + ep.path
        r = await client.request(ep.method, url)
        if r.status_code in (200,201,202,204):
            s, sev = score("API5")
            findings.append(Finding(
                rule="API5", title=RULES["API5"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Admin-tagged endpoint succeeded without credentials.",
                evidence={"response": summarize_response(r)}
            ))
    return findings
