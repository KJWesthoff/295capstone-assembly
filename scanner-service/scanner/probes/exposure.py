
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response

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
                    findings.append(Finding(
                        rule="API3", title=RULES["API3"], severity=sev, score=s,
                        endpoint=ep.path, method=ep.method,
                        description="Live response includes sensitive-looking fields.",
                        evidence={"fields": hints, "sample": summarize_response(r)}
                    ))
    return findings
