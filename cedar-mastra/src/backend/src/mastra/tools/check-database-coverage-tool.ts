/**
 * Database Coverage Check Tool
 * 
 * Allows agents to query the database for metadata about code example coverage
 * and determine if ingestion of new data is needed.
 * 
 * Use cases:
 * - Before analyzing a scan, check if we have sufficient code examples
 * - Decide whether to call githubAdvisoryIngestionTool
 * - Provide transparency about database state to users
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import {
  getPostgresPool,
  executeQueryWithRetry,
  validateEnvironment
} from '../lib/database-auth';

export const checkDatabaseCoverageTool = createTool({
  id: 'check-database-coverage',
  description: `Check if the database has sufficient code examples for specific CWEs or OWASP categories.

Use this tool to:
- Determine if you need to fetch more code examples before analysis
- Assess database coverage for specific vulnerabilities
- Make intelligent decisions about calling the github-advisory-ingestion tool

The tool returns statistics and a recommendation on whether enrichment is needed.

Decision criteria:
- Needs enrichment if less than 50% of CWEs have code examples
- OR if average examples per CWE is less than 2
- OR if specific critical CWEs are missing examples`,

  inputSchema: z.object({
    cwes: z
      .array(z.string())
      .describe('Array of CWE IDs to check (e.g., ["CWE-89", "CWE-79"])'),
    owaspIds: z
      .array(z.string())
      .optional()
      .describe('Optional: Array of OWASP IDs to check (e.g., ["A03:2021"])'),
    minCoveragePercent: z
      .number()
      .min(0)
      .max(100)
      .default(50)
      .optional()
      .describe('Minimum percentage of CWEs that must have examples (default: 50)'),
    minExamplesPerCWE: z
      .number()
      .min(1)
      .default(2)
      .optional()
      .describe('Minimum average examples per CWE (default: 2)'),
  }),

  outputSchema: z.object({
    summary: z.object({
      totalCWEs: z.number(),
      cwesWithExamples: z.number(),
      coveragePercent: z.number(),
      averageExamplesPerCWE: z.number(),
    }),
    recommendations: z.object({
      needsEnrichment: z.boolean(),
      reason: z.string(),
      suggestedAction: z.string(),
    }),
    details: z.object({
      cwesWithExamples: z.array(z.string()),
      cwesMissingExamples: z.array(z.string()),
      exampleBreakdown: z.array(
        z.object({
          cwe_id: z.string(),
          example_count: z.number(),
          has_vulnerable: z.boolean(),
          has_fixed: z.boolean(),
        })
      ),
    }),
    recommendedEcosystem: z.string().optional(),
  }),

  execute: async ({ context }) => {
    const {
      cwes,
      owaspIds = [],
      minCoveragePercent = 50,
      minExamplesPerCWE = 2,
    } = context;

    if (cwes.length === 0) {
      return {
        summary: {
          totalCWEs: 0,
          cwesWithExamples: 0,
          coveragePercent: 0,
          averageExamplesPerCWE: 0,
        },
        recommendations: {
          needsEnrichment: false,
          reason: 'No CWEs provided for coverage check',
          suggestedAction: 'Provide CWE IDs to check coverage',
        },
        details: {
          cwesWithExamples: [],
          cwesMissingExamples: [],
          exampleBreakdown: [],
        },
      };
    }

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

    try {
      console.log(`🔍 Checking database coverage for ${cwes.length} CWEs...`);

      // Query 1: Get detailed breakdown per CWE
      const detailQuery = `
        SELECT 
          c.cwe_id,
          COALESCE(ce.example_count, 0) as example_count,
          COALESCE(ce.has_vulnerable, false) as has_vulnerable,
          COALESCE(ce.has_fixed, false) as has_fixed
        FROM unnest($1::text[]) as c(cwe_id)
        LEFT JOIN (
          SELECT 
            cwe_id,
            COUNT(*) as example_count,
            bool_or(example_type = 'vulnerable') as has_vulnerable,
            bool_or(example_type = 'fixed') as has_fixed
          FROM code_examples
          GROUP BY cwe_id
        ) ce ON c.cwe_id = ce.cwe_id
        ORDER BY example_count DESC
      `;

      const detailResult = await executeQueryWithRetry(detailQuery, [cwes]);

      // Query 2: Get aggregate statistics
      const statsQuery = `
        WITH cwe_stats AS (
          SELECT 
            cwe_id,
            COUNT(*) as example_count,
            COUNT(DISTINCT example_type) as example_type_count
          FROM code_examples
          WHERE cwe_id = ANY($1)
          GROUP BY cwe_id
        )
        SELECT 
          COUNT(DISTINCT c.cwe_id) as total_cwes,
          COUNT(DISTINCT cs.cwe_id) as cwes_with_examples,
          COALESCE(AVG(cs.example_count), 0) as avg_examples_per_cwe,
          array_agg(c.cwe_id) FILTER (WHERE cs.cwe_id IS NOT NULL) as cwes_with_data,
          array_agg(c.cwe_id) FILTER (WHERE cs.cwe_id IS NULL) as cwes_without_data
        FROM unnest($1::text[]) as c(cwe_id)
        LEFT JOIN cwe_stats cs ON c.cwe_id = cs.cwe_id
      `;

      const statsResult = await executeQueryWithRetry(statsQuery, [cwes]);
      const stats = statsResult.rows[0];

      const totalCWEs = parseInt(stats.total_cwes || '0');
      const cwesWithExamples = parseInt(stats.cwes_with_examples || '0');
      const averageExamplesPerCWE = parseFloat(stats.avg_examples_per_cwe || '0');
      const cwesWithData = stats.cwes_with_data || [];
      const cwesWithoutData = stats.cwes_without_data || [];

      const coveragePercent = totalCWEs > 0 ? (cwesWithExamples / totalCWEs) * 100 : 0;

      // Decision logic
      const coverageInsufficient = coveragePercent < minCoveragePercent;
      const averageTooLow = averageExamplesPerCWE < minExamplesPerCWE;
      const needsEnrichment = coverageInsufficient || averageTooLow;

      // Build recommendation
      let reason = '';
      let suggestedAction = '';

      if (!needsEnrichment) {
        reason = `Database has good coverage: ${coveragePercent.toFixed(1)}% of CWEs have examples with an average of ${averageExamplesPerCWE.toFixed(1)} examples per CWE.`;
        suggestedAction = 'Proceed with analysis using existing database content.';
      } else {
        const reasons: string[] = [];
        if (coverageInsufficient) {
          reasons.push(
            `only ${coveragePercent.toFixed(1)}% of CWEs have examples (threshold: ${minCoveragePercent}%)`
          );
        }
        if (averageTooLow) {
          reasons.push(
            `average of ${averageExamplesPerCWE.toFixed(1)} examples per CWE is below threshold of ${minExamplesPerCWE}`
          );
        }
        reason = `Database needs enrichment: ${reasons.join(' and ')}.`;
        suggestedAction = `Call the github-advisory-ingestion tool to fetch more code examples. Missing examples for: ${cwesWithoutData.slice(0, 5).join(', ')}${cwesWithoutData.length > 5 ? ` and ${cwesWithoutData.length - 5} more` : ''}.`;
      }

      // Try to infer ecosystem from CWE patterns (basic heuristic)
      let recommendedEcosystem: string | undefined;
      // This is a simple heuristic - you could enhance this based on your scan metadata
      // For now, we'll leave it undefined unless the user provides it via scan metadata

      console.log(`📊 Coverage Results:
        - Total CWEs: ${totalCWEs}
        - CWEs with examples: ${cwesWithExamples} (${coveragePercent.toFixed(1)}%)
        - Average examples per CWE: ${averageExamplesPerCWE.toFixed(1)}
        - Needs enrichment: ${needsEnrichment ? 'YES ⚠️' : 'NO ✅'}`);

      return {
        summary: {
          totalCWEs,
          cwesWithExamples,
          coveragePercent: parseFloat(coveragePercent.toFixed(2)),
          averageExamplesPerCWE: parseFloat(averageExamplesPerCWE.toFixed(2)),
        },
        recommendations: {
          needsEnrichment,
          reason,
          suggestedAction,
        },
        details: {
          cwesWithExamples: cwesWithData,
          cwesMissingExamples: cwesWithoutData,
          exampleBreakdown: detailResult.rows.map((row) => ({
            cwe_id: row.cwe_id,
            example_count: parseInt(row.example_count || '0'),
            has_vulnerable: row.has_vulnerable === true,
            has_fixed: row.has_fixed === true,
          })),
        },
        recommendedEcosystem,
      };
    } catch (error: any) {
      console.error('❌ Error checking database coverage:', error);

      // Check if it's a database connection issue
      if (error.message?.includes('DATABASE_URL')) {
        throw new Error(
          'Database connection not configured. Please set DATABASE_URL environment variable.'
        );
      }

      throw new Error(`Failed to check database coverage: ${error.message}`);
    }
  },
});

