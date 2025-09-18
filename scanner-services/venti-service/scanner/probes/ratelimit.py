
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response
import anyio

async def run(spec, client, authctx, server_base: str, burst: int=15) -> List[Finding]:
    findings: List[Finding] = []
    target = None
    for ep in spec.endpoints:
        if ep.method == "GET" and ("health" in ep.path or "status" in ep.path):
            target = ep
            break
    if not target:
        target = next((e for e in spec.endpoints if e.method == "GET"), None)
    if not target:
        return findings

    url = server_base.rstrip("/") + target.path
    results = []
    async with anyio.create_task_group() as tg:
        async def one():
            r = await client.request("GET", url)
            results.append(r)
        for _ in range(burst):
            tg.start_soon(one)

    statuses = [r.status_code for r in results]
    headers = [r.headers for r in results]
    got_429 = any(r.status_code == 429 for r in results)
    has_headers = any("X-RateLimit-Remaining" in h or "Retry-After" in h for h in headers)

    if (not got_429) and (not has_headers):
        s, sev = score("API4")
        findings.append(Finding(
            rule="API4", title=RULES["API4"], severity=sev, score=s,
            endpoint=target.path, method=target.method,
            description="Burst of requests did not trigger 429 nor expose rate limit headers; RL likely missing.",
            evidence={"statuses": statuses[:10], "headers_sample": [{k:v for k,v in r.headers.items() if k in ("X-RateLimit-Remaining","Retry-After")} for r in results[:3]]}
        ))
    return findings
