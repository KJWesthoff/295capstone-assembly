
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response
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
            findings.append(Finding(
                rule="API2", title=RULES["API2"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Endpoint returns success for unauthenticated/invalid credentials requests.",
                evidence={k:v for k,v in {
                    "unauth": summarize_response(r_none),
                    "bogus": summarize_response(r_bogus),
                    "basic_default": summarize_response(r_basic) if r_basic else None
                }.items() if v is not None}
            ))
    return findings
