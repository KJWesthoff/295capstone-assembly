/**
 * Executive KPI Calculator
 *
 * Transforms raw scan findings into executive-level KPIs
 * Used to replace mock data in ExecutiveView
 */

import { VulnerabilityFinding, ScanResultsState } from '@/app/cedar-os/scanState';

export interface ExecutiveKPIs {
  riskScore: number; // 0-10
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
  slaCompliance: number; // 0-100%
  mttrMedian: number; // days
  mttrP95: number; // days
  publicExploitCount: number;
  internetFacingCount: number;
}

export interface TopRisk {
  id: string;
  title: string;
  affectedSystems: string[];
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  exploitStatus: 'public' | 'theoretical';
  internetFacing: boolean;
  owner: string;
  eta: string;
  relatedBreaches?: string[];
}

export interface ComplianceSnapshot {
  owaspCounts: Record<string, number>; // API1: 5, API2: 3, etc.
  nistStatus: {
    identify: number;
    protect: number;
    detect: number;
    respond: number;
    recover: number;
  };
}

/**
 * Calculate overall risk score (0-10) based on findings
 */
export function calculateRiskScore(findings: VulnerabilityFinding[]): number {
  if (findings.length === 0) return 0;

  // Weight findings by severity
  const weights = {
    Critical: 10,
    High: 7,
    Medium: 4,
    Low: 2,
  };

  const totalWeight = findings.reduce((sum, f) => {
    return sum + (weights[f.severity] || 0);
  }, 0);

  // Normalize to 0-10 scale
  // Assume 50+ weighted findings = 10/10 risk
  const maxWeight = 50;
  const normalizedScore = Math.min(10, (totalWeight / maxWeight) * 10);

  return Math.round(normalizedScore * 10) / 10; // Round to 1 decimal
}

/**
 * Determine risk level from risk score
 */
export function getRiskLevel(riskScore: number): 'critical' | 'high' | 'medium' | 'low' {
  if (riskScore >= 8) return 'critical';
  if (riskScore >= 6) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
}

/**
 * Calculate executive KPIs from scan results
 */
export function calculateExecutiveKPIs(scanResults: ScanResultsState | null): ExecutiveKPIs {
  if (!scanResults || !scanResults.findings) {
    return {
      riskScore: 0,
      riskLevel: 'low',
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalFindings: 0,
      slaCompliance: 100,
      mttrMedian: 0,
      mttrP95: 0,
      publicExploitCount: 0,
      internetFacingCount: 0,
    };
  }

  const { findings, summary } = scanResults;
  const riskScore = calculateRiskScore(findings);

  // Estimate public-facing endpoints (heuristic: if endpoint doesn't contain /admin or /internal)
  const internetFacingCount = findings.filter(f =>
    !f.endpoint.includes('/admin') &&
    !f.endpoint.includes('/internal') &&
    !f.endpoint.includes('/debug')
  ).length;

  // Estimate public exploits (heuristic: injection vulnerabilities are commonly exploited)
  const publicExploitCount = findings.filter(f =>
    f.rule === 'API8' || // Injection
    f.rule === 'API2' || // Broken Auth (commonly exploited)
    f.rule === 'API1'    // BOLA (commonly exploited)
  ).length;

  // SLA compliance calculation (placeholder - would need historical data)
  // For now, estimate based on severity: Critical < 24h, High < 7d, Medium < 30d
  const criticalOverdue = summary.critical; // Assume all critical are overdue if not fixed
  const highOverdue = summary.high;
  const totalSLAFindings = summary.critical + summary.high + summary.medium;
  const overdueCount = criticalOverdue + (highOverdue * 0.5); // Weight critical more
  const slaCompliance = totalSLAFindings > 0
    ? Math.max(0, Math.round(((totalSLAFindings - overdueCount) / totalSLAFindings) * 100))
    : 100;

  // MTTR estimation (placeholder - would need historical remediation data)
  // Rough estimate: Critical=2d, High=5d, Medium=15d, Low=30d
  const estimatedMTTR = {
    Critical: 2,
    High: 5,
    Medium: 15,
    Low: 30,
  };

  const mttrValues = findings.map(f => estimatedMTTR[f.severity] || 15);
  mttrValues.sort((a, b) => a - b);

  const mttrMedian = mttrValues.length > 0
    ? mttrValues[Math.floor(mttrValues.length / 2)]
    : 0;

  const mttrP95 = mttrValues.length > 0
    ? mttrValues[Math.floor(mttrValues.length * 0.95)]
    : 0;

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    criticalCount: summary.critical,
    highCount: summary.high,
    mediumCount: summary.medium,
    lowCount: summary.low,
    totalFindings: summary.total,
    slaCompliance,
    mttrMedian,
    mttrP95,
    publicExploitCount,
    internetFacingCount,
  };
}

/**
 * Extract top risks from findings
 */
export function extractTopRisks(findings: VulnerabilityFinding[], limit: number = 5): TopRisk[] {
  // Sort by severity and score
  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...findings].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.score - a.score;
  });

  // Group by rule to avoid duplicates
  const uniqueRisks = new Map<string, TopRisk>();

  sorted.forEach(finding => {
    if (uniqueRisks.size >= limit) return;

    const key = finding.rule;
    if (!uniqueRisks.has(key)) {
      // Determine if internet-facing
      const internetFacing = !finding.endpoint.includes('/admin') &&
                             !finding.endpoint.includes('/internal');

      // Determine exploit status
      const exploitStatus = ['API8', 'API2', 'API1'].includes(finding.rule)
        ? 'public' as const
        : 'theoretical' as const;

      // Collect affected systems (endpoints)
      const affectedSystems = [finding.endpoint];

      uniqueRisks.set(key, {
        id: finding.id,
        title: finding.title,
        affectedSystems,
        severity: finding.severity,
        exploitStatus,
        internetFacing,
        owner: 'Security Team', // Placeholder - would come from triage data
        eta: finding.severity === 'Critical' ? '24-48h' :
             finding.severity === 'High' ? '7 days' :
             finding.severity === 'Medium' ? '30 days' : '90 days',
        relatedBreaches: exploitStatus === 'public'
          ? getRelatedBreaches(finding.rule)
          : undefined,
      });
    } else {
      // Add to existing risk's affected systems
      const existing = uniqueRisks.get(key)!;
      if (!existing.affectedSystems.includes(finding.endpoint)) {
        existing.affectedSystems.push(finding.endpoint);
      }
    }
  });

  return Array.from(uniqueRisks.values());
}

/**
 * Get related breach examples for vulnerability types
 */
function getRelatedBreaches(rule: string): string[] {
  const breaches: Record<string, string[]> = {
    'API1': ['Peloton 2021 - BOLA exposed user data'],
    'API2': ['Optus 2022 - Broken auth leaked 10M records'],
    'API8': ['Equifax 2017 - SQL injection breached 147M records'],
  };
  return breaches[rule] || [];
}

/**
 * Calculate compliance snapshot
 */
export function calculateComplianceSnapshot(findings: VulnerabilityFinding[]): ComplianceSnapshot {
  // Count findings by OWASP API category
  const owaspCounts: Record<string, number> = {};
  findings.forEach(f => {
    owaspCounts[f.rule] = (owaspCounts[f.rule] || 0) + 1;
  });

  // Map to NIST CSF categories (simplified)
  const nistMapping: Record<string, keyof ComplianceSnapshot['nistStatus']> = {
    'API9': 'identify',  // Asset Management
    'API2': 'protect',   // Authentication
    'API5': 'protect',   // Authorization
    'API7': 'protect',   // Misconfiguration
    'API10': 'detect',   // Logging
    'API4': 'respond',   // Rate Limiting
  };

  const nistStatus = {
    identify: 100,
    protect: 100,
    detect: 100,
    respond: 100,
    recover: 100,
  };

  // Reduce score based on findings
  findings.forEach(f => {
    const category = nistMapping[f.rule];
    if (category) {
      const penalty = f.severity === 'Critical' ? 20 :
                     f.severity === 'High' ? 15 :
                     f.severity === 'Medium' ? 10 : 5;
      nistStatus[category] = Math.max(0, nistStatus[category] - penalty);
    }
  });

  return {
    owaspCounts,
    nistStatus,
  };
}

/**
 * Generate trend data (placeholder - would come from historical scans)
 */
export function generateTrendData(scanResults: ScanResultsState | null): {
  dates: string[];
  riskScores: number[];
  findingCounts: number[];
} {
  if (!scanResults) {
    return {
      dates: [],
      riskScores: [],
      findingCounts: [],
    };
  }

  // Generate mock trend for last 30 days
  // In production, this would query historical scans from database
  const dates: string[] = [];
  const riskScores: number[] = [];
  const findingCounts: number[] = [];

  const currentRisk = calculateRiskScore(scanResults.findings);
  const currentCount = scanResults.summary.total;

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);

    // Simulate improving trend (risk decreasing over time)
    const dayFactor = 1 + (i / 30) * 0.5; // 1.0 to 1.5
    riskScores.push(Math.min(10, currentRisk * dayFactor));
    findingCounts.push(Math.floor(currentCount * dayFactor));
  }

  return {
    dates,
    riskScores,
    findingCounts,
  };
}
