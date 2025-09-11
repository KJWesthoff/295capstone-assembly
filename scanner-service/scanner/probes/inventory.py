from typing import Set, Tuple, List
from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score

COMMON_SIBLINGS = ["search", "_search", "export", "debug", "internal", "v1", "v2"]

async def check_inventory(client, spec, server_base: str) -> List[Finding]:
    findings: List[Finding] = []
    documented: Set[Tuple[str, str]] = {(e.method, e.path) for e in spec.endpoints}
    paths: Set[str] = {e.path for e in spec.endpoints}

    # 1) Alternate methods on documented GET paths
    for ep in [e for e in spec.endpoints if e.method == "GET"]:
        for alt in ("HEAD", "POST", "PUT", "DELETE"):
            if (alt, ep.path) in documented:
                continue
            url = server_base.rstrip("/") + ep.path
            r = await client.request(alt, url)
            if r.status_code in (200, 201, 202, 204):
                s, sev = score("API9")
                findings.append(Finding(
                    rule="API9",
                    title=RULES["API9"],
                    endpoint=ep.path,
                    method=alt,
                    description="Endpoint appears to support an undocumented method.",
                    severity=sev,
                    score=s,
                    evidence={"status": r.status_code, "hint": "alt-method"}
                ))

    # 2) Guess common hidden sibling paths
    for p in list(paths)[:50]:
        for suf in COMMON_SIBLINGS:
            guess = (p.rstrip("/") + "/" + suf).replace("//", "/")
            if guess in paths:
                continue
            url = server_base.rstrip("/") + guess
            r = await client.request("GET", url)
            if r.status_code in (200, 201, 202, 204):
                s, sev = score("API9")
                findings.append(Finding(
                    rule="API9",
                    title=RULES["API9"],
                    endpoint=guess,
                    method="GET",
                    description="Potential undocumented endpoint responded with success.",
                    severity=sev,
                    score=s,
                    evidence={"status": r.status_code, "hint": "hidden-sibling"}
                ))
    return findings
