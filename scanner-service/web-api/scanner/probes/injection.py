import re
from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score

ERROR_PATTERNS = [
    r"SQL syntax", r"SQLSTATE", r"ORA-\d{5}", r"mysql_", r"PDOException",
    r"MongoError", r"Traceback \(most recent call last\)", r"System\.InvalidOperationException",
    r"ReferenceError", r"TypeError", r"stack trace"
]
ERR_RE = re.compile("|".join(ERROR_PATTERNS), re.IGNORECASE)

FUZZ = [
    "' OR '1'='1", "\" OR \"1\"=\"1", "')--",
    "../../etc/passwd",
    "<script>alert(1)</script>",
    "<?xml version='1.0'?><!DOCTYPE a [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><a>&xxe;</a>"
]

def _looks_error(text: str|None) -> bool:
    if not text: return False
    return bool(ERR_RE.search(text[:4000]))

async def check_injection(client, spec, dangerous: bool=False):
    findings = []
    targets = [e for e in spec.endpoints if e.method == "GET"]
    if dangerous:
        targets += [e for e in spec.endpoints if e.method in ("POST","PUT","PATCH")]

    server_base = spec.servers[0] if getattr(spec, "servers", None) else ""

    for ep in targets[:50]:
        url = server_base.rstrip("/") + ep.path

        # Query fuzz
        for payload in FUZZ[:4]:
            r = await client.request(ep.method, url, params={"q": payload})
            if _looks_error(getattr(r, "text", "")):
                s, sev = score("API8")
                findings.append(Finding(
                    rule="API8",
                    title=RULES["API8"],
                    endpoint=ep.path,
                    method=ep.method,
                    description="Possible injection via query param (error-like output observed).",
                    severity=sev,
                    score=s,
                    evidence={"status": r.status_code, "param": "q", "payload": payload, "excerpt": r.text[:300]}
                ))
                break

        # Header fuzz
        r = await client.request(ep.method, url, headers={"User-Agent": FUZZ[0]})
        if _looks_error(getattr(r, "text", "")):
            s, sev = score("API8")
            findings.append(Finding(
                rule="API8",
                title=RULES["API8"],
                endpoint=ep.path,
                method=ep.method,
                description="Possible injection via header (error-like output observed).",
                severity=sev,
                score=s,
                evidence={"status": r.status_code, "header": "User-Agent", "payload": FUZZ[0], "excerpt": r.text[:300]}
            ))

        # Body fuzz (dangerous only)
        if dangerous and ep.method in ("POST","PUT","PATCH"):
            r = await client.request(ep.method, url, json={"name": FUZZ[1]})
            if _looks_error(getattr(r, "text", "")):
                s, sev = score("API8")
                findings.append(Finding(
                    rule="API8",
                    title=RULES["API8"],
                    endpoint=ep.path,
                    method=ep.method,
                    description="Possible injection via JSON body (error-like output observed).",
                    severity=sev,
                    score=s,
                    evidence={"status": r.status_code, "json_key": "name", "payload": FUZZ[1], "excerpt": r.text[:300]}
                ))
    return findings
