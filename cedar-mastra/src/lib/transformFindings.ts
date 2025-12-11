import type { Finding, Evidence } from "@/types/finding";
import type { VulnerabilityFinding } from "@/app/cedar-os/scanState";

// CVSS scores by severity for consistent display
const SEVERITY_TO_CVSS: Record<string, number> = {
  Critical: 9.5,
  High: 7.8,
  Medium: 5.5,
  Low: 3.2,
};

// Exploit likelihood by severity (simulated based on real-world patterns)
const SEVERITY_EXPLOIT_CHANCE: Record<string, number> = {
  Critical: 0.7,  // 70% of critical vulns have exploits
  High: 0.4,      // 40% of high
  Medium: 0.15,   // 15% of medium
  Low: 0.05,      // 5% of low
};

// Fixability base scores by severity (higher severity = more urgency but also more attention)
const SEVERITY_FIXABILITY_BASE: Record<string, number> = {
  Critical: 7.5,
  High: 6.8,
  Medium: 5.5,
  Low: 4.2,
};

/**
 * Deterministic hash for consistent random-like values per finding
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

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

  // Calculate CVSS from severity (more reliable than scanner score)
  const cvss = SEVERITY_TO_CVSS[vuln.severity] || 5.0;

  // Deterministic "random" based on finding ID for consistent display
  const hash = hashCode(vuln.id);
  const hashNormalized = (hash % 100) / 100; // 0.00 - 0.99

  // Determine exploit presence based on severity + deterministic variance
  const exploitChance = SEVERITY_EXPLOIT_CHANCE[vuln.severity] || 0.2;
  const exploitPresent = hashNormalized < exploitChance;
  const exploitSignal = exploitPresent ? 7 + (hash % 3) : 1 + (hash % 3); // 7-9 if present, 1-3 if not

  // Calculate fixability score (base + variance)
  const fixabilityBase = SEVERITY_FIXABILITY_BASE[vuln.severity] || 5.0;
  const fixabilityVariance = ((hash % 20) - 10) / 10; // -1.0 to +1.0
  const fixabilityScore = Math.max(1, Math.min(10, fixabilityBase + fixabilityVariance));

  // Calculate exposure based on endpoint characteristics
  const path = endpointObj.path.toLowerCase();
  let exposure = 5;
  if (path.includes('/admin') || path.includes('/internal')) exposure = 3;
  else if (path.includes('/public') || path.includes('/api/v1') || path.includes('/users')) exposure = 8;
  else if (path.includes('/auth') || path.includes('/login')) exposure = 9;

  // Calculate blast radius based on method and endpoint
  let blastRadius = 5;
  if (endpointObj.method === 'DELETE') blastRadius = 9;
  else if (endpointObj.method === 'PUT' || endpointObj.method === 'PATCH') blastRadius = 7;
  else if (endpointObj.method === 'POST') blastRadius = 6;
  else if (endpointObj.method === 'GET' && path.includes('/user')) blastRadius = 7;

  // Priority score calculation
  const priorityScore = (
    0.4 * cvss +
    0.25 * exploitSignal +
    0.15 * 7 + // OWASP weight
    0.1 * exposure +
    0.05 * 8 + // recency (new findings)
    0.05 * blastRadius
  );

  return {
    id: vuln.id,
    endpoint: endpointObj,
    severity: vuln.severity,
    cvss,
    exploitSignal,
    exploitPresent,
    owasp: vuln.rule || "Unknown",
    cwe: [],
    cve: [],
    scanners: [vuln.scanner],
    status: "New",
    evidenceId: vuln.id,
    exposure,
    recencyTrend: 8,
    blastRadius,
    priorityScore,
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
    suggestedFix: vuln.description,
    prStatus: "None",
    testsStatus: "None",
    fixabilityScore,
    evidence: vuln.evidence as Evidence,
  };
}

/**
 * Transform an array of VulnerabilityFindings to Findings
 */
export function transformVulnerabilityFindings(vulns: VulnerabilityFinding[]): Finding[] {
  return vulns.map(transformVulnerabilityToFinding);
}
