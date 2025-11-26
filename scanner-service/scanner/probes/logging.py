from scanner.core.models import Finding
from scanner.analysis.mapping import RULES
from scanner.scoring.risk import score
from scanner.core.evidence import (
    capture_request_details,
    capture_response_details,
    capture_evidence,
    get_default_poc_references
)

OBS_HEADERS = ["X-Request-Id", "X-Correlation-Id", "Trace-Id", "X-Trace-Id"]

async def check_logging(client, spec, server_base: str):
    findings = []
    target = next((e for e in spec.endpoints if e.method == "GET"), None)
    if not target:
        return findings

    url = server_base.rstrip("/") + target.path
    codes = []
    hdr_hits = 0
    sample_response = None
    for i in range(5):
        r = await client.request("GET", url, headers={"Authorization": "Bearer invalid.invalid.invalid"})
        codes.append(r.status_code)
        if any(h in r.headers for h in OBS_HEADERS):
            hdr_hits += 1
        if i == 0:  # Capture first response for evidence
            sample_response = r

    success_on_invalid = any(c in (200,201,202,204) for c in codes)
    inconsistent = len(set(codes)) >= 3
    no_obs = hdr_hits == 0

    if (success_on_invalid or inconsistent) and no_obs:
        s, sev = score("API10")

        # Capture structured evidence
        if sample_response:
            request = capture_request_details(
                method="GET",
                url=url,
                headers={"Authorization": "Bearer invalid.invalid.invalid"},
                params={},
                body=None
            )

            response_obj = capture_response_details(sample_response)

            issues = []
            if success_on_invalid:
                issues.append("accepts invalid authentication tokens")
            if inconsistent:
                issues.append(f"returns inconsistent status codes ({codes})")
            if no_obs:
                issues.append(f"missing observability headers ({', '.join(OBS_HEADERS[:2])}, etc.)")

            evidence_obj = capture_evidence(
                request=request,
                response=response_obj,
                auth_context=f"Testing {target.path} with invalid Bearer token across 5 requests",
                probe_name="Insufficient Logging & Monitoring (API10)",
                why_vulnerable=f"API endpoint {target.path} demonstrates poor logging and monitoring practices: {'; '.join(issues)}. Without proper request correlation, security teams cannot track attack patterns, investigate incidents, or detect ongoing breaches.",
                attack_scenario="Attacker launches reconnaissance or attacks using invalid/expired credentials. API lacks request tracing headers, making attacks invisible to monitoring systems. Inconsistent responses or successful invalid auth indicate logging failures. Attacker exploits blind spots to enumerate resources, test vulnerabilities, or exfiltrate data undetected.",
                steps=[
                    f"Send 5 GET requests to {target.path} with invalid Bearer token",
                    f"Observe status codes: {codes}",
                    f"Check for observability headers: {hdr_hits}/5 responses included tracing headers",
                    "API lacks proper request correlation for incident investigation" if no_obs else "Inconsistent behavior indicates logging gaps",
                    "Security team cannot detect, trace, or respond to suspicious activity"
                ],
                poc_references=get_default_poc_references("API10")
            )

            findings.append(Finding(
                rule="API10",
                title=RULES["API10"],
                endpoint=target.path,
                method="GET",
                description="Invalid-auth requests produced success/inconsistent responses without correlation headers.",
                severity=sev,
                score=s,
                evidence=evidence_obj.model_dump()
            ))
    return findings
