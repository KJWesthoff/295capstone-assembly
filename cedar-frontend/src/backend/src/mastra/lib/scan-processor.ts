/**
 * Scan Preprocessing Utilities
 * 
 * This module handles the preprocessing of vulnerability scan results:
 * - Deduplication of findings
 * - Grouping by rule type
 * - Severity analysis
 * - Token-efficient summarization
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ScanFindingSchema = z.object({
  rule: z.string(),
  title: z.string(),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
  score: z.number().min(0).max(10),
  endpoint: z.string(),
  method: z.string(),
  description: z.string(),
  evidence: z.record(z.any()).optional(),
});

export const RawScanResultSchema = z.object({
  scan_id: z.string().optional(),
  total: z.number(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  findings: z.array(ScanFindingSchema),
});

export type ScanFinding = z.infer<typeof ScanFindingSchema>;
export type RawScanResult = z.infer<typeof RawScanResultSchema>;

// ============================================================================
// OWASP to CWE Mapping
// ============================================================================

/**
 * Maps scan rules to OWASP categories and their primary CWEs
 * Based on OWASP_TO_CWE_CVE_MAPPING.md
 */
export const RULE_TO_OWASP_CWE_MAP: Record<string, {
  owasp_category: string;
  owasp_id: string;
  primary_cwes: string[];
  related_cwes: string[];
}> = {
  sql_injection: {
    owasp_category: 'Injection',
    owasp_id: 'A03:2021',
    primary_cwes: ['CWE-89'],
    related_cwes: ['CWE-20', 'CWE-74', 'CWE-564'],
  },
  broken_authentication: {
    owasp_category: 'Identification and Authentication Failures',
    owasp_id: 'A07:2021',
    primary_cwes: ['CWE-287'],
    related_cwes: ['CWE-306', 'CWE-798', 'CWE-259', 'CWE-522'],
  },
  improper_authorization: {
    owasp_category: 'Broken Access Control',
    owasp_id: 'A01:2021',
    primary_cwes: ['CWE-639'],
    related_cwes: ['CWE-284', 'CWE-285', 'CWE-732', 'CWE-862'],
  },
  bola_user_deletion: {
    owasp_category: 'Broken Access Control',
    owasp_id: 'A01:2021',
    primary_cwes: ['CWE-639'],
    related_cwes: ['CWE-284', 'CWE-285', 'CWE-862'],
  },
  jwt_weak_secret: {
    owasp_category: 'Cryptographic Failures',
    owasp_id: 'A02:2021',
    primary_cwes: ['CWE-327'],
    related_cwes: ['CWE-261', 'CWE-916', 'CWE-326', 'CWE-347'],
  },
  mass_assignment: {
    owasp_category: 'Broken Access Control',
    owasp_id: 'A01:2021',
    primary_cwes: ['CWE-915'],
    related_cwes: ['CWE-250', 'CWE-282'],
  },
  information_disclosure: {
    owasp_category: 'Broken Access Control',
    owasp_id: 'A01:2021',
    primary_cwes: ['CWE-200'],
    related_cwes: ['CWE-209', 'CWE-532', 'CWE-359', 'CWE-615'],
  },
  improper_auth_flow: {
    owasp_category: 'Identification and Authentication Failures',
    owasp_id: 'A07:2021',
    primary_cwes: ['CWE-287'],
    related_cwes: ['CWE-290', 'CWE-294', 'CWE-384', 'CWE-613'],
  },
  // OWASP API Security rules (from v1 scan format)
  API4: {
    owasp_category: 'Unrestricted Resource Consumption',
    owasp_id: 'API4:2023',
    primary_cwes: ['CWE-770'],
    related_cwes: ['CWE-400', 'CWE-799'],
  },
  API7: {
    owasp_category: 'Security Misconfiguration',
    owasp_id: 'API7:2023',
    primary_cwes: ['CWE-16'],
    related_cwes: ['CWE-2', 'CWE-11', 'CWE-1032'],
  },
};

// ============================================================================
// Processed Scan Types
// ============================================================================

export interface GroupedFinding {
  rule: string;
  title: string;
  count: number;
  severity: string;
  maxScore: number;
  avgScore: number;
  endpoints: Array<{ method: string; path: string }>;
  description: string;
  owasp_category: string;
  owasp_id: string;
  primary_cwes: string[];
  related_cwes: string[];
}

export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ProcessedScan {
  scanId?: string;
  summary: {
    totalFindings: number;
    uniqueRules: string[];
    severityBreakdown: SeverityBreakdown;
    affectedEndpoints: number;
    riskScore: number; // Calculated weighted risk score (0-100)
  };
  findingsByRule: Record<string, GroupedFinding>;
  prioritizedFindings: GroupedFinding[]; // Sorted by risk
}

// ============================================================================
// Core Processing Functions
// ============================================================================

/**
 * Calculate a weighted risk score for a finding
 * Considers severity, score, and number of affected endpoints
 */
function calculateRiskScore(finding: GroupedFinding): number {
  const severityWeights: Record<string, number> = {
    Critical: 10,
    High: 7,
    Medium: 4,
    Low: 2,
  };

  const severityWeight = severityWeights[finding.severity] || 1;
  const scoreWeight = finding.maxScore;
  const frequencyWeight = Math.log10(finding.count + 1); // Logarithmic scale

  // Weighted formula: severity * score * log(frequency)
  return Math.min(100, severityWeight * scoreWeight * frequencyWeight);
}

/**
 * Calculate severity breakdown from grouped findings
 */
function calculateSeverityBreakdown(
  findingsByRule: Record<string, GroupedFinding>
): SeverityBreakdown {
  return Object.values(findingsByRule).reduce(
    (acc, finding) => {
      const severity = finding.severity.toLowerCase() as keyof SeverityBreakdown;
      acc[severity] += finding.count;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

/**
 * Calculate overall scan risk score (0-100)
 * Higher score = more risky
 */
function calculateOverallRiskScore(findingsByRule: Record<string, GroupedFinding>): number {
  const findings = Object.values(findingsByRule);
  if (findings.length === 0) return 0;

  // Average of top 3 highest risk findings
  const topRisks = findings
    .map(calculateRiskScore)
    .sort((a, b) => b - a)
    .slice(0, 3);

  const avgRisk = topRisks.reduce((sum, risk) => sum + risk, 0) / topRisks.length;
  return Math.round(avgRisk);
}

/**
 * Main preprocessing function
 * Deduplicates findings, groups by rule, enriches with OWASP/CWE data
 */
export function preprocessScan(scan: RawScanResult): ProcessedScan {
  // Validate input
  const validated = RawScanResultSchema.parse(scan);

  // Group findings by rule
  const findingsByRule: Record<string, GroupedFinding> = {};

  for (const finding of validated.findings) {
    if (!findingsByRule[finding.rule]) {
      // Get OWASP/CWE mapping
      const mapping = RULE_TO_OWASP_CWE_MAP[finding.rule] || {
        owasp_category: 'Unknown',
        owasp_id: 'Unknown',
        primary_cwes: [],
        related_cwes: [],
      };

      findingsByRule[finding.rule] = {
        rule: finding.rule,
        title: finding.title,
        count: 0,
        severity: finding.severity,
        maxScore: finding.score,
        avgScore: finding.score,
        endpoints: [],
        description: finding.description,
        owasp_category: mapping.owasp_category,
        owasp_id: mapping.owasp_id,
        primary_cwes: mapping.primary_cwes,
        related_cwes: mapping.related_cwes,
      };
    }

    const group = findingsByRule[finding.rule];
    group.count++;
    group.maxScore = Math.max(group.maxScore, finding.score);
    group.avgScore = (group.avgScore * (group.count - 1) + finding.score) / group.count;
    group.endpoints.push({
      method: finding.method,
      path: finding.endpoint,
    });

    // Upgrade severity if a higher severity is found
    const severityOrder = ['Low', 'Medium', 'High', 'Critical'];
    if (
      severityOrder.indexOf(finding.severity) > severityOrder.indexOf(group.severity)
    ) {
      group.severity = finding.severity;
    }
  }

  // Calculate summary statistics
  const severityBreakdown = calculateSeverityBreakdown(findingsByRule);
  const riskScore = calculateOverallRiskScore(findingsByRule);
  const uniqueEndpoints = new Set(
    validated.findings.map(f => f.endpoint)
  );

  // Prioritize findings by risk
  const prioritizedFindings = Object.values(findingsByRule)
    .sort((a, b) => calculateRiskScore(b) - calculateRiskScore(a));

  return {
    scanId: validated.scan_id,
    summary: {
      totalFindings: validated.total,
      uniqueRules: Object.keys(findingsByRule),
      severityBreakdown,
      affectedEndpoints: uniqueEndpoints.size,
      riskScore,
    },
    findingsByRule,
    prioritizedFindings,
  };
}

/**
 * Generate a concise text summary for embedding
 * Optimized for semantic search
 */
export function generateScanEmbeddingText(processed: ProcessedScan): string {
  const { summary, prioritizedFindings } = processed;

  const severityText = Object.entries(summary.severityBreakdown)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => `${count} ${severity}`)
    .join(', ');

  const findingsText = prioritizedFindings
    .slice(0, 5) // Top 5 findings only
    .map(f => `${f.title} (${f.owasp_id}): ${f.description}`)
    .join('\n');

  return `
API Vulnerability Scan Results
Total Findings: ${summary.totalFindings}
Severity Breakdown: ${severityText}
Risk Score: ${summary.riskScore}/100
Affected Endpoints: ${summary.affectedEndpoints}

Top Vulnerabilities:
${findingsText}
`.trim();
}

/**
 * Generate token-efficient context for LLM
 * Removes redundant information
 */
export function generateLLMContext(processed: ProcessedScan): string {
  const { summary, prioritizedFindings } = processed;

  return `
## Scan Summary
- Total Issues: ${summary.totalFindings}
- Unique Vulnerability Types: ${summary.uniqueRules.length}
- Risk Score: ${summary.riskScore}/100 (${getRiskLevel(summary.riskScore)})
- Severity: ${summary.severityBreakdown.critical} Critical, ${summary.severityBreakdown.high} High, ${summary.severityBreakdown.medium} Medium, ${summary.severityBreakdown.low} Low

## Findings (Prioritized by Risk)

${prioritizedFindings.map((f, i) => `
### ${i + 1}. ${f.title} (${f.owasp_id})
- **Rule**: ${f.rule}
- **Severity**: ${f.severity} (Score: ${f.maxScore.toFixed(1)})
- **Occurrences**: ${f.count}× across ${f.endpoints.length} endpoints
- **Description**: ${f.description}
- **OWASP Category**: ${f.owasp_category}
- **Primary CWEs**: ${f.primary_cwes.join(', ')}
- **Affected Endpoints**:
${f.endpoints.slice(0, 3).map(e => `  - ${e.method} ${e.path}`).join('\n')}${f.endpoints.length > 3 ? `\n  - ... and ${f.endpoints.length - 3} more` : ''}
`).join('\n---\n')}
`.trim();
}

/**
 * Get risk level label from numeric score
 */
function getRiskLevel(score: number): string {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Extract all unique CWE IDs from processed scan
 * Used for batch retrieval
 */
export function extractUniqueCWEs(processed: ProcessedScan): string[] {
  const cwes = new Set<string>();

  for (const finding of Object.values(processed.findingsByRule)) {
    finding.primary_cwes.forEach(cwe => cwes.add(cwe));
    finding.related_cwes.forEach(cwe => cwes.add(cwe));
  }

  return Array.from(cwes);
}

/**
 * Extract all unique OWASP IDs from processed scan
 * Used for batch retrieval
 */
export function extractUniqueOWASPIds(processed: ProcessedScan): string[] {
  const owaspIds = new Set<string>();

  for (const finding of Object.values(processed.findingsByRule)) {
    if (finding.owasp_id !== 'Unknown') {
      owaspIds.add(finding.owasp_id);
    }
  }

  return Array.from(owaspIds);
}

