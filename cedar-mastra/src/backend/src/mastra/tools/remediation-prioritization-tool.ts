/**
 * Remediation Prioritization Tool
 *
 * Analyzes vulnerabilities and suggests fix order based on multiple factors:
 * - Severity (CVSS score)
 * - Exploitability (how easy to exploit)
 * - Asset criticality (public-facing vs internal)
 * - Attack surface (number of affected endpoints)
 * - Available fixes (code examples exist?)
 * - Effort required (time to fix)
 *
 * Uses a weighted scoring system to generate P0/P1/P2/P3 priorities
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  getPostgresPool,
  executeQueryWithRetry,
  validateEnvironment
} from '../lib/database-auth';

// ============================================================================
// Scoring Weights
// ============================================================================

const WEIGHTS = {
  severity: 0.30,        // 30% - CVSS score / severity level
  exploitability: 0.25,  // 25% - How easy to exploit
  assetCriticality: 0.20, // 20% - Public vs internal
  attackSurface: 0.15,   // 15% - Number of affected endpoints
  fixAvailability: 0.10, // 10% - Code examples/patches available
};

// ============================================================================
// Types
// ============================================================================

interface VulnerabilityInput {
  id: string;
  cveId?: string;
  cweId?: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore?: number;
  affectedEndpoints: string[];
  isPublicFacing: boolean;
  estimatedEffort?: string; // "2-4 hours", "1-2 days", etc.
}

interface PrioritizationResult {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  priorityScore: number; // 0-100
  reasoning: string;
  fixOrder: number; // 1, 2, 3, etc.
  recommendedDeadline: string;
  factors: {
    severityScore: number;
    exploitabilityScore: number;
    assetCriticalityScore: number;
    attackSurfaceScore: number;
    fixAvailabilityScore: number;
  };
  recommendations: string[];
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate severity score (0-100)
 */
function calculateSeverityScore(severity: string, cvssScore?: number): number {
  if (cvssScore !== undefined) {
    return cvssScore * 10; // CVSS 0-10 → 0-100
  }

  // Fallback to severity level
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 95;
    case 'HIGH': return 75;
    case 'MEDIUM': return 50;
    case 'LOW': return 25;
    default: return 0;
  }
}

/**
 * Calculate exploitability score based on CWE type
 */
async function calculateExploitabilityScore(
  cweId?: string
): Promise<number> {
  if (!cweId) return 50; // Unknown

  // High exploitability CWEs (easy to exploit)
  const highExploitability = [
    'CWE-89',  // SQL Injection
    'CWE-79',  // XSS
    'CWE-78',  // OS Command Injection
    'CWE-77',  // Command Injection
    'CWE-94',  // Code Injection
    'CWE-22',  // Path Traversal
    'CWE-798', // Hard-coded Credentials
  ];

  // Medium exploitability
  const mediumExploitability = [
    'CWE-502', // Deserialization
    'CWE-611', // XXE
    'CWE-918', // SSRF
    'CWE-352', // CSRF
    'CWE-287', // Authentication Bypass
  ];

  if (highExploitability.includes(cweId)) return 90;
  if (mediumExploitability.includes(cweId)) return 60;

  // Check if we have exploit examples in database
  try {
    const result = await executeQueryWithRetry(
      `SELECT COUNT(*) as exploit_count
       FROM code_examples
       WHERE cwe_id = $1 AND example_type = 'exploit'`,
      [cweId]
    );

    const exploitCount = parseInt(result.rows[0]?.exploit_count || '0');
    if (exploitCount > 0) return 80; // Has known exploits
  } catch (error) {
      // Check if it's a database connection issue
      if (error.message?.includes('DATABASE_URL')) {
        throw new Error(
          'Database connection not configured. Please set DATABASE_URL environment variable.'
        );
      }

    console.error('Error checking exploits:', error);
  }

  return 40; // Low exploitability by default
}

/**
 * Calculate asset criticality score
 */
function calculateAssetCriticalityScore(
  isPublicFacing: boolean,
  affectedEndpoints: string[]
): number {
  let score = isPublicFacing ? 80 : 40; // Public = high priority

  // Check for critical endpoints
  const criticalPatterns = ['/api/auth', '/login', '/admin', '/payment', '/checkout'];
  const hasCriticalEndpoint = affectedEndpoints.some(endpoint =>
    criticalPatterns.some(pattern => endpoint.includes(pattern))
  );

  if (hasCriticalEndpoint) score += 20;

  return Math.min(score, 100);
}

/**
 * Calculate attack surface score (based on number of affected endpoints)
 */
function calculateAttackSurfaceScore(affectedEndpoints: string[]): number {
  const count = affectedEndpoints.length;

  if (count === 0) return 0;
  if (count === 1) return 30;
  if (count <= 3) return 50;
  if (count <= 10) return 70;
  return 90; // 10+ endpoints
}

/**
 * Calculate fix availability score (higher = easier to fix)
 */
async function calculateFixAvailabilityScore(
  cveId?: string,
  cweId?: string
): Promise<number> {
  let score = 50; // Default

  try {
    // Check for fixed code examples
    const query = `
      SELECT COUNT(*) as fix_count
      FROM code_examples
      WHERE example_type = 'fixed'
        AND (cve_id = $1 OR cwe_id = $2)
    `;

    const result = await executeQueryWithRetry(query, [cveId || null, cweId || null]);
    const fixCount = parseInt(result.rows[0]?.fix_count || '0');

    if (fixCount >= 3) return 90; // Multiple examples
    if (fixCount >= 1) return 70; // At least one example
    if (fixCount === 0) return 30; // No examples

  } catch (error) {
      // Check if it's a database connection issue
      if (error.message?.includes('DATABASE_URL')) {
        throw new Error(
          'Database connection not configured. Please set DATABASE_URL environment variable.'
        );
      }

    console.error('Error checking fix availability:', error);
  }

  return score;
}

/**
 * Calculate overall priority score
 */
function calculatePriorityScore(factors: {
  severityScore: number;
  exploitabilityScore: number;
  assetCriticalityScore: number;
  attackSurfaceScore: number;
  fixAvailabilityScore: number;
}): number {
  return (
    factors.severityScore * WEIGHTS.severity +
    factors.exploitabilityScore * WEIGHTS.exploitability +
    factors.assetCriticalityScore * WEIGHTS.assetCriticality +
    factors.attackSurfaceScore * WEIGHTS.attackSurface +
    factors.fixAvailabilityScore * WEIGHTS.fixAvailability
  );
}

/**
 * Assign priority level based on score
 */
function assignPriorityLevel(score: number): 'P0' | 'P1' | 'P2' | 'P3' {
  if (score >= 80) return 'P0'; // Critical
  if (score >= 60) return 'P1'; // High
  if (score >= 40) return 'P2'; // Medium
  return 'P3'; // Low
}

/**
 * Get recommended deadline
 */
function getRecommendedDeadline(priority: 'P0' | 'P1' | 'P2' | 'P3'): string {
  switch (priority) {
    case 'P0': return 'Immediate (< 24 hours)';
    case 'P1': return 'Within 7 days';
    case 'P2': return 'Within 30 days';
    case 'P3': return 'Within 90 days';
  }
}

/**
 * Generate reasoning text
 */
function generateReasoning(
  vuln: VulnerabilityInput,
  factors: PrioritizationResult['factors'],
  priority: 'P0' | 'P1' | 'P2' | 'P3'
): string {
  const reasons: string[] = [];

  if (factors.severityScore >= 75) {
    reasons.push(`High severity (${vuln.severity})`);
  }

  if (factors.exploitabilityScore >= 80) {
    reasons.push('Highly exploitable vulnerability type');
  }

  if (vuln.isPublicFacing) {
    reasons.push('Affects public-facing endpoints');
  }

  if (vuln.affectedEndpoints.length > 5) {
    reasons.push(`Large attack surface (${vuln.affectedEndpoints.length} endpoints)`);
  }

  if (factors.fixAvailabilityScore >= 70) {
    reasons.push('Fix examples available');
  } else if (factors.fixAvailabilityScore < 40) {
    reasons.push('Limited fix guidance available');
  }

  const reasoning = `Assigned ${priority} priority because: ${reasons.join(', ')}.`;
  return reasoning;
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  vuln: VulnerabilityInput,
  factors: PrioritizationResult['factors'],
  priority: 'P0' | 'P1' | 'P2' | 'P3'
): string[] {
  const recommendations: string[] = [];

  if (priority === 'P0' || priority === 'P1') {
    recommendations.push('Assign to senior developer immediately');
    recommendations.push('Set up monitoring/alerting for exploitation attempts');
  }

  if (vuln.isPublicFacing) {
    recommendations.push('Consider WAF rules or rate limiting as temporary mitigation');
  }

  if (factors.exploitabilityScore >= 80) {
    recommendations.push('Review authentication and input validation thoroughly');
  }

  if (factors.fixAvailabilityScore < 40) {
    recommendations.push('Research similar CVEs and consult security team');
  } else {
    recommendations.push('Review available code examples and apply similar patterns');
  }

  if (vuln.affectedEndpoints.length > 1) {
    recommendations.push(`Fix all ${vuln.affectedEndpoints.length} affected endpoints simultaneously`);
  }

  return recommendations;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const remediationPrioritizationTool = createTool({
  id: 'remediation-prioritization',
  description: `Analyzes vulnerabilities and suggests fix order based on multiple factors including severity, exploitability, asset criticality, attack surface, and fix availability. Returns prioritized list with P0/P1/P2/P3 assignments and recommended deadlines.`,

  inputSchema: z.object({
    vulnerabilities: z.array(z.object({
      id: z.string().describe('Unique identifier for this vulnerability'),
      cveId: z.string().optional().describe('CVE ID if available'),
      cweId: z.string().optional().describe('CWE ID if available'),
      title: z.string().describe('Vulnerability title'),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).describe('Severity level'),
      cvssScore: z.number().min(0).max(10).optional().describe('CVSS score (0-10)'),
      affectedEndpoints: z.array(z.string()).describe('List of affected endpoints/URLs'),
      isPublicFacing: z.boolean().describe('Whether endpoints are public-facing'),
      estimatedEffort: z.string().optional().describe('Estimated fix effort (e.g., "2-4 hours")'),
    })).describe('List of vulnerabilities to prioritize'),
  }),

  outputSchema: z.object({
    prioritizedList: z.array(z.object({
      id: z.string(),
      title: z.string(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']),
      priorityScore: z.number(),
      reasoning: z.string(),
      fixOrder: z.number(),
      recommendedDeadline: z.string(),
      factors: z.object({
        severityScore: z.number(),
        exploitabilityScore: z.number(),
        assetCriticalityScore: z.number(),
        attackSurfaceScore: z.number(),
        fixAvailabilityScore: z.number(),
      }),
      recommendations: z.array(z.string()),
    })),
    summary: z.object({
      totalVulnerabilities: z.number(),
      p0Count: z.number(),
      p1Count: z.number(),
      p2Count: z.number(),
      p3Count: z.number(),
      averagePriorityScore: z.number(),
    }),
  }),

  execute: async ({ context, mastra }) => {
    // Validate environment before proceeding
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(
        `Missing required environment variables: ${envValidation.missing.join(', ')}. ` +
        'Please configure your environment variables for database access.'
      );
    }
    
    // Log any warnings
    if (envValidation.warnings.length > 0) {
      console.log('⚠️  Environment warnings:', envValidation.warnings.join('; '));
    }

    const { vulnerabilities } = context;
    const logger = mastra?.getLogger();

    logger?.info('🎯 Remediation Prioritization Tool - Starting analysis', {
      vulnerabilityCount: vulnerabilities.length,
    });

    // Connect to database
    try {
      const results: PrioritizationResult[] = [];

      // Score each vulnerability
      for (const vuln of vulnerabilities) {
        const factors = {
          severityScore: calculateSeverityScore(vuln.severity, vuln.cvssScore),
          exploitabilityScore: await calculateExploitabilityScore(vuln.cweId),
          assetCriticalityScore: calculateAssetCriticalityScore(
            vuln.isPublicFacing,
            vuln.affectedEndpoints
          ),
          attackSurfaceScore: calculateAttackSurfaceScore(vuln.affectedEndpoints),
          fixAvailabilityScore: await calculateFixAvailabilityScore(
            vuln.cveId,
            vuln.cweId
          ),
        };

        const priorityScore = calculatePriorityScore(factors);
        const priority = assignPriorityLevel(priorityScore);
        const reasoning = generateReasoning(vuln, factors, priority);
        const recommendations = generateRecommendations(vuln, factors, priority);

        results.push({
          id: vuln.id,
          title: vuln.title,
          priority,
          priorityScore: Math.round(priorityScore * 10) / 10,
          reasoning,
          fixOrder: 0, // Will be set after sorting
          recommendedDeadline: getRecommendedDeadline(priority),
          factors: {
            severityScore: Math.round(factors.severityScore * 10) / 10,
            exploitabilityScore: Math.round(factors.exploitabilityScore * 10) / 10,
            assetCriticalityScore: Math.round(factors.assetCriticalityScore * 10) / 10,
            attackSurfaceScore: Math.round(factors.attackSurfaceScore * 10) / 10,
            fixAvailabilityScore: Math.round(factors.fixAvailabilityScore * 10) / 10,
          },
          recommendations,
        });
      }

      // Sort by priority score (highest first)
      results.sort((a, b) => b.priorityScore - a.priorityScore);

      // Assign fix order
      results.forEach((result, index) => {
        result.fixOrder = index + 1;
      });

      // Calculate summary
      const summary = {
        totalVulnerabilities: results.length,
        p0Count: results.filter(r => r.priority === 'P0').length,
        p1Count: results.filter(r => r.priority === 'P1').length,
        p2Count: results.filter(r => r.priority === 'P2').length,
        p3Count: results.filter(r => r.priority === 'P3').length,
        averagePriorityScore: Math.round(
          (results.reduce((sum, r) => sum + r.priorityScore, 0) / results.length) * 10
        ) / 10,
      };

      logger?.info('✅ Prioritization complete', {
        p0: summary.p0Count,
        p1: summary.p1Count,
        p2: summary.p2Count,
        p3: summary.p3Count,
      });

      return {
        prioritizedList: results,
        summary,
      };

    } catch (error: any) {
      logger?.error('❌ Error during prioritization:', error);

      // Check if it's a database connection issue
      if (error.message?.includes('DATABASE_URL')) {
        throw new Error(
          'Database connection not configured. Please set DATABASE_URL environment variable.'
        );
      }

      throw new Error(`Failed to prioritize vulnerabilities: ${error.message}`);
    }
  },
});
