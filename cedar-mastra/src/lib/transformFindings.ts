import type { Finding, Evidence } from "@/types/finding";
import type { VulnerabilityFinding } from "@/app/cedar-os/scanState";

/**
 * Transform VulnerabilityFinding (from scanner API) to Finding (for dashboard display)
 * Handles both raw scanner data (endpoint as string) and already-transformed data (endpoint as object)
 */
export function transformVulnerabilityToFinding(vuln: VulnerabilityFinding): Finding {
  // Handle case where endpoint might already be transformed to an object
  // This can happen if data was stored in localStorage after transformation
  const endpointObj = typeof vuln.endpoint === 'object' && vuln.endpoint !== null
    ? {
        method: (vuln.endpoint as any).method || vuln.method || "GET",
        path: (vuln.endpoint as any).path || "/",
        service: (vuln.endpoint as any).service || "API",
      }
    : {
        method: vuln.method || "GET",
        path: vuln.endpoint || "/",
        service: "API",
      };

  return {
    id: vuln.id,
    endpoint: endpointObj,
    severity: vuln.severity,
    cvss: (vuln.score || 0) > 10 ? (vuln.score || 0) / 10 : (vuln.score || 0),
    exploitSignal: 0,
    exploitPresent: vuln.exploit_available || false,
    owasp: vuln.rule || "Unknown",
    cwe: [],
    cve: [],
    scanners: [vuln.scanner],
    status: "New",
    evidenceId: vuln.id,
    exposure: 5,
    recencyTrend: 10,
    blastRadius: 5,
    priorityScore: (vuln.score || 50) > 10 ? (vuln.score || 50) / 10 : (vuln.score || 50),
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    owner: "Unassigned",
    slaDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    flags: {
      isNew: true,
      isRegressed: false,
      isResolved: false,
    },
    summaryHumanReadable: vuln.description,
    nistCsf: [],
    nist80053: [],
    repo: undefined,
    file: undefined,
    language: undefined,
    framework: undefined,
    suggestedFix: undefined,
    prStatus: "None",
    testsStatus: "None",
    fixabilityScore: undefined,
    evidence: vuln.evidence as Evidence,
  };
}

/**
 * Transform an array of VulnerabilityFindings to Findings
 */
export function transformVulnerabilityFindings(vulns: VulnerabilityFinding[]): Finding[] {
  return vulns.map(transformVulnerabilityToFinding);
}
