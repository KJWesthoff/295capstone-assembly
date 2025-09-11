from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score

def _cors_issues(headers: dict) -> list:
    issues = []
    aco = headers.get("Access-Control-Allow-Origin")
    acc = headers.get("Access-Control-Allow-Credentials", "")
    if aco == "*" and acc.lower() == "true":
        issues.append("CORS allows any origin with credentials=true")
    return issues

def _hsts_missing(headers: dict, base_url: str) -> bool:
    if base_url.lower().startswith("https://"):
        return "Strict-Transport-Security" not in headers
    return False

async def check_misconfiguration(client, spec, server_base: str):
    findings = []

    # 1) Plain HTTP base URL (no TLS)
    if server_base.lower().startswith("http://"):
        s, sev = score("API7")
        findings.append(Finding(
            rule="API7",
            title=RULES["API7"],
            endpoint="/",
            method="GET",
            description="Server base URL uses plaintext HTTP (no TLS).",
            severity=sev,
            score=s,
            evidence={"server_base": server_base}
        ))

    # 2) CORS / HSTS check via preflight on a representative GET endpoint
    target = next((e for e in spec.endpoints if e.method == "GET"), None)
    if not target:
        return findings

    url = server_base.rstrip("/") + target.path
    r = await client.request(
        "OPTIONS",
        url,
        headers={
            "Origin": "https://scanner.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    cors_list = _cors_issues(r.headers)
    hsts = _hsts_missing(r.headers, server_base)

    if cors_list or hsts:
        s, sev = score("API7")
        evidence = {
            "status": r.status_code,
            "headers": dict(r.headers),
            "hsts_missing": bool(hsts),
        }
        if cors_list:
            evidence["cors"] = cors_list

        findings.append(Finding(
            rule="API7",
            title=RULES["API7"],
            endpoint=target.path,
            method="OPTIONS",
            description="Potential security misconfiguration (permissive CORS and/or missing HSTS).",
            severity=sev,
            score=s,
            evidence=evidence,
        ))

    return findings
