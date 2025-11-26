
from typing import List
from ..core.models import Finding
from ..analysis.mapping import RULES
from ..scoring.risk import score
from .common import summarize_response
import anyio
from ..core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

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

        # Capture structured evidence using first response
        sample_response = results[0] if results else None
        if sample_response:
            request = capture_request_details(
                method=target.method,
                url=url,
                headers=dict(sample_response.request.headers) if hasattr(sample_response, 'request') else {},
                params={},
                body=None
            )

            response_obj = capture_response_details(sample_response)

            evidence_obj = capture_evidence(
                request=request,
                response=response_obj,
                auth_context=f"Burst testing {target.path} with {burst} concurrent requests",
                probe_name="Lack of Resources & Rate Limiting (API4)",
                why_vulnerable=f"Sent {burst} concurrent requests to endpoint without encountering rate limiting (no HTTP 429 responses) or rate limit headers (X-RateLimit-*, Retry-After). This indicates the API lacks proper rate limiting controls.",
                attack_scenario=f"Attacker sends rapid burst of {burst}+ requests to overwhelm API resources or enumerate data without throttling. Can lead to denial of service, resource exhaustion, or rapid data extraction.",
                steps=[
                    f"Send burst of {burst} concurrent GET requests to {target.path}",
                    f"All requests return successful status codes: {statuses[:5]}{'...' if len(statuses) > 5 else ''}",
                    "No HTTP 429 (Too Many Requests) responses received",
                    "No rate limit headers (X-RateLimit-Remaining, Retry-After) present in responses",
                    "API accepts unlimited requests without throttling"
                ],
                poc_references=get_default_poc_references("API4")
            )

            findings.append(Finding(
                rule="API4", title=RULES["API4"], severity=sev, score=s,
                endpoint=target.path, method=target.method,
                description="Burst of requests did not trigger 429 nor expose rate limit headers; RL likely missing.",
                evidence=evidence_obj.model_dump()
            ))
    return findings
