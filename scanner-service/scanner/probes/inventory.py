from typing import Set, Tuple, List
from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score
from scanner.core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

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

                # Capture structured evidence
                request = capture_request_details(
                    method=alt,
                    url=url,
                    headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                    params={},
                    body=None
                )

                response_obj = capture_response_details(r)

                evidence_obj = capture_evidence(
                    request=request,
                    response=response_obj,
                    auth_context=f"Testing undocumented {alt} method on documented GET endpoint {ep.path}",
                    probe_name="Improper Inventory Management (API9) - Undocumented Method",
                    why_vulnerable=f"Endpoint {ep.path} is documented as GET only in API specification, but server responds successfully ({r.status_code}) to {alt} method. This undocumented method is not tracked in API inventory, may bypass security controls, and could expose dangerous functionality (e.g., DELETE without auth).",
                    attack_scenario=f"Attacker discovers undocumented {alt} method through enumeration or documentation gaps. Since it's not properly inventoried, it may lack authentication, rate limiting, or input validation. Attacker exploits unprotected {alt} operation to modify/delete resources.",
                    steps=[
                        f"Observe documented GET endpoint: {ep.path}",
                        f"Send {alt} request to same path",
                        f"Server responds with {r.status_code} (success)",
                        f"Undocumented {alt} method is functional but not tracked in API inventory",
                        "Attacker exploits undocumented method that may lack security controls"
                    ],
                    poc_references=get_default_poc_references("API9")
                )

                findings.append(Finding(
                    rule="API9",
                    title=RULES["API9"],
                    endpoint=ep.path,
                    method=alt,
                    description="Endpoint appears to support an undocumented method.",
                    severity=sev,
                    score=s,
                    evidence=evidence_obj.model_dump()
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

                # Capture structured evidence
                request = capture_request_details(
                    method="GET",
                    url=url,
                    headers=dict(r.request.headers) if hasattr(r, 'request') else {},
                    params={},
                    body=None
                )

                response_obj = capture_response_details(r)

                evidence_obj = capture_evidence(
                    request=request,
                    response=response_obj,
                    auth_context=f"Discovery testing for hidden endpoint {guess} (based on documented path {p})",
                    probe_name="Improper Inventory Management (API9) - Hidden Endpoint",
                    why_vulnerable=f"Undocumented endpoint {guess} responds successfully ({r.status_code}) but is not listed in API specification. Hidden endpoints like /debug, /internal, /_search, /export are common developer tools or admin interfaces that may bypass security controls and expose sensitive functionality.",
                    attack_scenario=f"Attacker fuzzes common path suffixes ({', '.join(COMMON_SIBLINGS[:3])}, etc.) on documented endpoints to discover hidden functionality. Finds operational endpoint {guess} that lacks proper authentication, authorization, or monitoring because it's not tracked in API inventory.",
                    steps=[
                        f"Start with documented endpoint: {p}",
                        f"Append common suffix to create guess: {guess}",
                        f"Send GET request to guessed path",
                        f"Server responds with {r.status_code} (success)",
                        "Undocumented endpoint discovered - may expose debug/admin functionality without security controls"
                    ],
                    poc_references=get_default_poc_references("API9")
                )

                findings.append(Finding(
                    rule="API9",
                    title=RULES["API9"],
                    endpoint=guess,
                    method="GET",
                    description="Potential undocumented endpoint responded with success.",
                    severity=sev,
                    score=s,
                    evidence=evidence_obj.model_dump()
                ))
    return findings
