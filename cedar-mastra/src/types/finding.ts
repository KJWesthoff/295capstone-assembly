export interface Finding {
  id: string;
  endpoint: {
    method: string;
    path: string;
    service: string;
  };
  severity: "Critical" | "High" | "Medium" | "Low";
  cvss: number;
  exploitSignal: number;
  exploitPresent: boolean;
  owasp: string;
  cwe: string[];
  cve: string[];
  scanners: string[];
  status: "New" | "Open" | "In Review" | "Resolved" | "Accepted Risk" | "False Positive";
  evidenceId: string;
  exposure: number;
  recencyTrend: number;
  blastRadius: number;
  priorityScore: number;
  firstSeen: string;
  lastSeen: string;
  owner: string;
  slaDue: string;
  flags: {
    isNew: boolean;
    isRegressed: boolean;
    isResolved: boolean;
  };
  summaryHumanReadable?: string;
  nistCsf?: string[];
  nist80053?: string[];
  // Developer-specific fields
  repo?: string;
  file?: string;
  language?: string;
  framework?: string;
  suggestedFix?: string;
  prStatus?: "None" | "Open" | "Merged";
  testsStatus?: "None" | "Failing" | "Passing";
  fixabilityScore?: number;
  evidence?: Evidence;
}

// HTTP request/response structures matching scanner backend evidence.py
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query_params?: Record<string, any>;
  body?: string;
  body_params?: Record<string, any>;
}

export interface HttpResponse {
  status_code: number;
  headers: Record<string, string>;
  body: string;
  size_bytes: number;
  time_ms?: number;
  redirect_chain?: string[];
}

export interface Evidence {
  // HTTP Transaction
  request: HttpRequest;
  response: HttpResponse;

  // Context
  auth_context: string;
  probe_name: string;
  timestamp: string;

  // Reproduction
  curl_command: string;
  steps: string[];

  // Analysis
  why_vulnerable: string;
  attack_scenario: string;
  poc_references: string[];

  // Optional additional data
  additional_requests?: Array<{
    description: string;
    url: string;
    status: number;
    note?: string;
  }>;
}

export function calculatePriorityScore(finding: Finding): number {
  const owaspWeight = 8; // normalized 0-10
  return (
    0.4 * finding.cvss +
    0.25 * finding.exploitSignal +
    0.15 * owaspWeight +
    0.1 * finding.exposure +
    0.05 * finding.recencyTrend +
    0.05 * finding.blastRadius
  );
}

export function getPriorityTooltip(finding: Finding): string {
  const exploitText = finding.exploitPresent ? "public exploit" : "no exploit";
  const statusText = finding.flags.isNew
    ? "new this week"
    : finding.flags.isRegressed
      ? "regressed"
      : "existing";
  return `Why ranked: CVSS ${finding.cvss}, ${exploitText}, exposure ${finding.exposure}/10, ${statusText}`;
}

export function calculateFixabilityScore(finding: Finding): number {
  // Heuristic: known pattern (0.35) + exploitability (0.25) + CVSS (0.20) + blast radius (0.10) + ownership (0.10)
  const knownPattern = finding.suggestedFix ? 8 : 3; // 0-10 scale
  const exploitability = finding.exploitSignal; // 0-10
  const cvssNormalized = finding.cvss; // already 0-10
  const blastRadiusInverted = 10 - finding.blastRadius; // inverse (smaller blast = easier)
  const ownership = (finding.owner && finding.testsStatus !== "None") ? 8 : 4; // 0-10

  return (
    0.35 * knownPattern +
    0.25 * exploitability +
    0.20 * cvssNormalized +
    0.10 * blastRadiusInverted +
    0.10 * ownership
  );
}

export function getFixabilityTooltip(finding: Finding): string {
  const advisoryMatch = finding.suggestedFix ? "✓" : "✗";
  const exploitText = finding.exploitPresent ? "✓" : "✗";
  const testsText = finding.testsStatus !== "None" ? "✓" : "✗";
  const blastText = finding.blastRadius <= 3 ? "small surface" : "wide surface";
  return `Why ranked: advisory match ${advisoryMatch}, public exploit ${exploitText}, cvss ${finding.cvss}, ${blastText}, tests exist ${testsText}`;
}
