
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response

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
            findings.append(Finding(
                rule="API1", title=RULES["API1"], severity=sev, score=s,
                endpoint=ep.path, method=ep.method,
                description="Two distinct object IDs returned success without auth; potential IDOR/BOLA.",
                evidence={"resp1": summarize_response(r1), "resp2": summarize_response(r2)}
            ))
    return findings
