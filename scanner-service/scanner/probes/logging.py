from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score

OBS_HEADERS = ["X-Request-Id", "X-Correlation-Id", "Trace-Id", "X-Trace-Id"]

async def check_logging(client, spec, server_base: str):
    findings = []
    target = next((e for e in spec.endpoints if e.method == "GET"), None)
    if not target:
        return findings

    url = server_base.rstrip("/") + target.path
    codes = []
    hdr_hits = 0
    for _ in range(5):
        r = await client.request("GET", url, headers={"Authorization": "Bearer invalid.invalid.invalid"})
        codes.append(r.status_code)
        if any(h in r.headers for h in OBS_HEADERS):
            hdr_hits += 1

    success_on_invalid = any(c in (200,201,202,204) for c in codes)
    inconsistent = len(set(codes)) >= 3
    no_obs = hdr_hits == 0

    if (success_on_invalid or inconsistent) and no_obs:
        s, sev = score("API10")
        findings.append(Finding(
            rule="API10",
            title=RULES["API10"],
            endpoint=target.path,
            method="GET",
            description="Invalid-auth requests produced success/inconsistent responses without correlation headers.",
            severity=sev,
            score=s,
            evidence={"codes": codes, "obs_headers_seen": hdr_hits}
        ))
    return findings
