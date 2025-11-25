/**
 * Scanner Data Transformation Library
 *
 * Transforms minimal scanner API findings (8-10 fields)
 * into enriched Finding objects (40+ fields) required by frontend.
 *
 * Used by:
 * - Next.js API route: `/api/scan/[scanId]/findings`
 * - Mastra tool: (future) for AI agent autonomous access
 */

import { Finding } from '@/types/finding';

// Scanner API types
export interface ScannerFinding {
  rule: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | 'Informational';
  score: number;
  endpoint: string;
  method: string;
  description: string;
  scanner: string;
  scanner_description?: string;
  evidence?: {
    request?: string;
    response?: string;
    poc_links?: string[];
  };
}

// Mapping tables
const RULE_TO_OWASP: Record<string, string> = {
  "bola": "API1:2023 — Broken Object Level Authorization",
  "bfla": "API5:2023 — Broken Function Level Authorization",
  "injection": "API8:2023 — Security Misconfiguration",
  "auth": "API2:2023 — Broken Authentication",
  "mass_assign": "API6:2023 — Unrestricted Access to Sensitive Business Flows",
  "exposure": "API3:2023 — Broken Object Property Level Authorization",
  "ratelimit": "API4:2023 — Unrestricted Resource Consumption",
  "misconfig": "API8:2023 — Security Misconfiguration",
  "inventory": "API9:2023 — Improper Inventory Management",
  "logging": "API10:2023 — Unsafe Consumption of APIs"
};

const SEVERITY_TO_CVSS: Record<string, number> = {
  "Critical": 9.5,
  "High": 7.5,
  "Medium": 5.0,
  "Low": 3.0,
  "Informational": 0.0
};

const RULE_TO_CWE: Record<string, string[]> = {
  "bola": ["CWE-639"],
  "bfla": ["CWE-285", "CWE-862"],
  "injection": ["CWE-89", "CWE-78"],
  "auth": ["CWE-287", "CWE-306"],
  "mass_assign": ["CWE-915"],
  "exposure": ["CWE-200"],
  "ratelimit": ["CWE-770"],
  "misconfig": ["CWE-16"],
  "inventory": ["CWE-1059"],
  "logging": ["CWE-778"]
};

const OWASP_TO_NIST_CSF: Record<string, string[]> = {
  "API1:2023": ["PR.AC-4", "PR.DS-5"],
  "API2:2023": ["PR.AC-1", "PR.AC-7"],
  "API3:2023": ["PR.DS-1", "PR.AC-4"],
  "API4:2023": ["DE.CM-1", "PR.PT-4"],
  "API5:2023": ["PR.AC-4", "PR.PT-3"],
  "API6:2023": ["PR.IP-3", "DE.CM-1"],
  "API7:2023": ["PR.IP-12", "DE.CM-7"],
  "API8:2023": ["PR.IP-1", "PR.PT-3"],
  "API9:2023": ["ID.AM-1", "ID.AM-2"],
  "API10:2023": ["PR.PT-1", "DE.CM-6"]
};

const OWASP_TO_NIST_80053: Record<string, string[]> = {
  "API1:2023": ["AC-3", "AC-6", "SC-3"],
  "API2:2023": ["IA-2", "IA-5", "AC-7"],
  "API3:2023": ["SC-28", "AC-3", "AC-4"],
  "API4:2023": ["SC-5", "AU-6", "SI-4"],
  "API5:2023": ["AC-3", "AC-6", "CM-7"],
  "API6:2023": ["CM-3", "AU-6", "SI-10"],
  "API7:2023": ["RA-5", "SI-2", "AU-6"],
  "API8:2023": ["CM-6", "CM-7", "SI-2"],
  "API9:2023": ["CM-8", "PM-5", "SA-22"],
  "API10:2023": ["AU-2", "AU-6", "AU-12"]
};

// Transformation functions
function extractService(endpoint: string): string {
  const segments = endpoint.split('/').filter(s => s && !s.startsWith(':') && !s.startsWith('{'));
  if (segments.length > 1) {
    return `${segments[0]}-service`;
  }
  return "api-gateway";
}

function calculateExposure(endpoint: string): number {
  if (endpoint.includes('/public') || endpoint.includes('/api/v1')) return 9;
  if (endpoint.includes('/internal') || endpoint.includes('/admin')) return 6;
  return 3;
}

function calculateBlastRadius(method: string, endpoint: string): number {
  if (method === 'DELETE' || (method === 'PUT' && endpoint.includes('/user'))) return 9;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return 6;
  return 3;
}

function calculateSlaDue(severity: string, firstSeen: string): string {
  const hours: Record<string, number> = {
    "Critical": 24,
    "High": 72,
    "Medium": 168,    // 7 days
    "Low": 720        // 30 days
  };

  const date = new Date(firstSeen);
  date.setHours(date.getHours() + (hours[severity] || 168));
  return date.toISOString();
}

/**
 * Transform a scanner finding into enriched Finding object
 *
 * @param raw - Raw finding from scanner API
 * @param index - Index for ID generation
 * @param scanTimestamp - Scan completion timestamp
 * @returns Enriched Finding object
 */
export function transformFinding(
  raw: ScannerFinding,
  index: number,
  scanTimestamp: string = new Date().toISOString()
): Finding {
  // Map severity (handle "Informational" → "Low")
  const severity = raw.severity === 'Informational' ? 'Low' : raw.severity;

  // Core security metadata
  const cvss = SEVERITY_TO_CVSS[severity] || 5.0;
  const owasp = RULE_TO_OWASP[raw.rule] || "API10:2023 — Unsafe Consumption of APIs";
  const cwe = RULE_TO_CWE[raw.rule] || [];

  // Exploit detection
  const exploitPresent = (raw.evidence?.poc_links?.length || 0) > 0;
  const exploitSignal = exploitPresent ? 8 : 2;

  // Calculate scores
  const exposure = calculateExposure(raw.endpoint);
  const blastRadius = calculateBlastRadius(raw.method, raw.endpoint);
  const recencyTrend = 5; // Default: new finding

  // Generate IDs
  const findingId = `finding-${raw.scanner}-${Date.now()}-${index}`;
  const evidenceId = `ev-${raw.scanner}-${index}`;

  return {
    id: findingId,
    endpoint: {
      method: raw.method,
      path: raw.endpoint,
      service: extractService(raw.endpoint)
    },
    severity: severity as "Critical" | "High" | "Medium" | "Low",
    cvss,
    exploitSignal,
    exploitPresent,
    owasp,
    cwe,
    cve: [], // TODO: Enrich with CVE Analysis tool
    scanners: [raw.scanner],
    status: "New",
    evidenceId,
    exposure,
    recencyTrend,
    blastRadius,
    priorityScore: 0, // Calculated by frontend calculatePriorityScore()
    firstSeen: scanTimestamp,
    lastSeen: scanTimestamp,
    owner: "Unassigned",
    slaDue: calculateSlaDue(severity, scanTimestamp),
    flags: {
      isNew: true,
      isRegressed: false,
      isResolved: false
    },
    summaryHumanReadable: raw.title || raw.description,
    nistCsf: OWASP_TO_NIST_CSF[owasp] || [],
    nist80053: OWASP_TO_NIST_80053[owasp] || [],
    // Developer fields (no mocks - leave undefined)
    suggestedFix: raw.description,
    prStatus: "None",
    testsStatus: "None",
    fixabilityScore: 0 // Calculated by frontend calculateFixabilityScore()
  };
}

/**
 * Transform array of scanner findings
 */
export function transformFindings(
  rawFindings: ScannerFinding[],
  scanTimestamp?: string
): Finding[] {
  const timestamp = scanTimestamp || new Date().toISOString();
  return rawFindings.map((raw, index) => transformFinding(raw, index, timestamp));
}
