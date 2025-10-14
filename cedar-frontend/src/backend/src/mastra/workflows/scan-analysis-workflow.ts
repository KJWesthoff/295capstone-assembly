/**
 * Scan Analysis Workflow with Intelligent Data Enrichment
 * 
 * This workflow demonstrates the pattern of:
 * 1. Analyzing scan results to extract metadata
 * 2. Querying PostgreSQL to check for existing code examples
 * 3. Conditionally fetching data if database lacks content
 * 4. Proceeding with enriched analysis
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { Client } from 'pg';
import { preprocessScan, extractUniqueCWEs, extractUniqueOWASPIds, type RawScanResult } from '../lib/scan-processor';
import { extractCVEIds } from '../lib/retrieval';
import { githubAdvisoryIngestionTool } from '../tools/github-advisory-ingestion-tool';
import { analyzeScanTool } from '../tools/analyze-scan-tool';
import { cveAnalysisTool } from '../tools/cve-analysis-tool';

// ============================================================================
// Step 1: Extract Metadata from Scan
// ============================================================================

const extractScanMetadataStep = createStep({
  id: 'extract-scan-metadata',
  description: 'Parse scan results and extract CVE/CWE/OWASP metadata',
  inputSchema: z.object({
    scanData: z.string().describe('Raw vulnerability scan JSON'),
  }),
  outputSchema: z.object({
    processed: z.any(), // ProcessedScan type
    cwes: z.array(z.string()),
    owaspIds: z.array(z.string()),
    cveIds: z.array(z.string()),
    ecosystems: z.array(z.string()),
    severities: z.record(z.number()),
    hasCVEs: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    let scan: RawScanResult;

    // Handle both string and object inputs
    if (typeof inputData.scanData === 'string') {
      try {
        scan = JSON.parse(inputData.scanData);
      } catch (error) {
        throw new Error('Invalid scan data: Expected JSON format with "findings" array. Parse error: ' + (error as Error).message);
      }
    } else if (typeof inputData.scanData === 'object' && inputData.scanData !== null) {
      // Already an object - use directly
      scan = inputData.scanData as RawScanResult;
    } else {
      throw new Error('Invalid scan data: Expected JSON string or object with "findings" array');
    }

    const processed = preprocessScan(scan);

    // Extract unique identifiers
    const cwes = extractUniqueCWEs(processed);
    const owaspIds = extractUniqueOWASPIds(processed);
    const cveIds = extractCVEIds(processed);

    // Determine ecosystems from scan metadata (if available)
    const ecosystems: string[] = [];
    // You could extract this from scan.target, scan.metadata, etc.

    console.log(`📋 Metadata extracted:
      - CWEs: ${cwes.length}
      - OWASP IDs: ${owaspIds.length}
      - CVE IDs: ${cveIds.length} ${cveIds.length > 0 ? `(${cveIds.join(', ')})` : ''}`
    );

    return {
      processed,
      cwes,
      owaspIds,
      cveIds,
      ecosystems,
      severities: processed.summary.severityBreakdown,
      hasCVEs: cveIds.length > 0,
    };
  },
});

// ============================================================================
// Step 2: Query Database for Coverage Statistics
// ============================================================================

const checkDatabaseCoverageStep = createStep({
  id: 'check-database-coverage',
  description: 'Query PostgreSQL to check if we have sufficient code examples for the identified vulnerabilities',
  inputSchema: z.object({
    cwes: z.array(z.string()),
    owaspIds: z.array(z.string()),
    ecosystems: z.array(z.string()),
    cveIds: z.array(z.string()),
    hasCVEs: z.boolean(),
  }),
  outputSchema: z.object({
    totalCWEs: z.number(),
    cwesWithExamples: z.number(),
    averageExamplesPerCWE: z.number(),
    needsEnrichment: z.boolean(),
    lackingCWEs: z.array(z.string()),
    recommendedEcosystem: z.string().optional(),
    cveIds: z.array(z.string()),
    hasCVEs: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    // Skip database check if no DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  No DATABASE_URL configured, skipping coverage check');
      return {
        totalCWEs: inputData.cwes.length,
        cwesWithExamples: 0,
        averageExamplesPerCWE: 0,
        needsEnrichment: false, // Skip enrichment if no DB
        lackingCWEs: inputData.cwes,
        recommendedEcosystem: inputData.ecosystems[0],
        cveIds: inputData.cveIds,
        hasCVEs: inputData.hasCVEs,
      };
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      // Query to check code example coverage
      const coverageQuery = `
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
          COUNT(DISTINCT c.cwe_id) as cwes_with_examples,
          COALESCE(AVG(cs.example_count), 0) as avg_examples_per_cwe,
          array_agg(c.cwe_id) FILTER (WHERE cs.cwe_id IS NULL) as lacking_cwes
        FROM unnest($1::text[]) as c(cwe_id)
        LEFT JOIN cwe_stats cs ON c.cwe_id = cs.cwe_id
      `;

      const result = await client.query(coverageQuery, [inputData.cwes]);
      const stats = result.rows[0];

      const cwesWithExamples = parseInt(stats.cwes_with_examples || '0');
      const averageExamplesPerCWE = parseFloat(stats.avg_examples_per_cwe || '0');
      const lackingCWEs = stats.lacking_cwes || [];

      // Decision criteria: Need enrichment if:
      // - Less than 50% of CWEs have examples, OR
      // - Average examples per CWE is less than 2
      const needsEnrichment = 
        (cwesWithExamples / inputData.cwes.length) < 0.5 ||
        averageExamplesPerCWE < 2;

      console.log(`📊 Database Coverage:
        - Total CWEs: ${inputData.cwes.length}
        - CWEs with examples: ${cwesWithExamples}
        - Average examples per CWE: ${averageExamplesPerCWE.toFixed(2)}
        - Needs enrichment: ${needsEnrichment}
        - Lacking CWEs: ${lackingCWEs.join(', ')}`);

      return {
        totalCWEs: inputData.cwes.length,
        cwesWithExamples,
        averageExamplesPerCWE,
        needsEnrichment,
        lackingCWEs,
        recommendedEcosystem: inputData.ecosystems[0], // Use first detected ecosystem
        cveIds: inputData.cveIds, // Pass CVE data through
        hasCVEs: inputData.hasCVEs,
      };
    } catch (error) {
      console.error('❌ Database connection error:', error);
      // Gracefully handle DB errors - continue without enrichment check
      return {
        totalCWEs: inputData.cwes.length,
        cwesWithExamples: 0,
        averageExamplesPerCWE: 0,
        needsEnrichment: false, // Skip enrichment on DB error
        lackingCWEs: inputData.cwes,
        recommendedEcosystem: inputData.ecosystems[0],
        cveIds: inputData.cveIds,
        hasCVEs: inputData.hasCVEs,
      };
    } finally {
      try {
        await client.end();
      } catch (e) {
        // Ignore errors when closing already-closed connection
      }
    }
  },
});

// ============================================================================
// Step 3: Enrich Database with GitHub Advisories (Conditional)
// ============================================================================

const enrichDatabaseStep = createStep({
  id: 'enrich-database',
  description: 'Fetch and ingest code examples from GitHub Advisory Database',
  inputSchema: z.object({
    recommendedEcosystem: z.string().optional(),
    lackingCWEs: z.array(z.string()),
  }),
  outputSchema: z.object({
    enrichmentPerformed: z.boolean(),
    advisoriesProcessed: z.number(),
    codeExamplesInserted: z.number(),
    cveIds: z.array(z.string()),
    hasCVEs: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const cveIds = (inputData as any).cveIds || [];
    const hasCVEs = (inputData as any).hasCVEs || false;

    if (!inputData.recommendedEcosystem) {
      console.log('⏭️  Skipping enrichment: No ecosystem detected');
      return {
        enrichmentPerformed: false,
        advisoriesProcessed: 0,
        codeExamplesInserted: 0,
        cveIds,
        hasCVEs,
      };
    }

    console.log(`🔄 Enriching database with ${inputData.recommendedEcosystem} advisories...`);

    // Execute GitHub Advisory Ingestion Tool
    const result = await githubAdvisoryIngestionTool.execute({
      context: {
        ecosystem: inputData.recommendedEcosystem as any,
        severity: 'critical',
        maxPages: 3, // Fetch 300 advisories (balance speed vs coverage)
      },
      runId: crypto.randomUUID(),
      runtimeContext: {},
    } as any);

    console.log(`✅ Enrichment complete: ${result.stats.codeExamplesInserted} new examples`);

    return {
      enrichmentPerformed: result.success,
      advisoriesProcessed: result.stats.advisoriesProcessed,
      codeExamplesInserted: result.stats.codeExamplesInserted,
      cveIds,
      hasCVEs,
    };
  },
});

// ============================================================================
// Step 4: No Enrichment Needed (Skip Path)
// ============================================================================

const skipEnrichmentStep = createStep({
  id: 'skip-enrichment',
  description: 'Database has sufficient coverage, proceed with analysis',
  inputSchema: z.object({}),
  outputSchema: z.object({
    enrichmentPerformed: z.boolean(),
    advisoriesProcessed: z.number(),
    codeExamplesInserted: z.number(),
    cveIds: z.array(z.string()),
    hasCVEs: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const cveIds = (inputData as any).cveIds || [];
    const hasCVEs = (inputData as any).hasCVEs || false;

    console.log('✅ Database has sufficient coverage, skipping enrichment');
    return {
      enrichmentPerformed: false,
      advisoriesProcessed: 0,
      codeExamplesInserted: 0,
      cveIds,
      hasCVEs,
    };
  },
});

// ============================================================================
// Step 5: Generate Security Analysis
// ============================================================================

const generateAnalysisStep = createStep({
  id: 'generate-analysis',
  description: 'Run CVE-aware security analysis with enriched database',
  inputSchema: z.object({
    scanData: z.string(),
    enrichmentPerformed: z.boolean(),
    codeExamplesInserted: z.number(),
    hasCVEs: z.boolean(),
    cveIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    scanContext: z.string(),
    securityContext: z.string(),

    // PHASE 2: Structured code examples passed through from analyze-scan-tool
    codeExamples: z.array(z.object({
      cwe_id: z.string(),
      language: z.string(),
      example_type: z.enum(['vulnerable', 'fixed', 'exploit']),
      code: z.string(),
      explanation: z.string(),
      source_url: z.string().optional(),
    })),

    metadata: z.object({
      totalFindings: z.number(),
      uniqueRules: z.number(),
      owaspEntriesRetrieved: z.number(),
      cweEntriesRetrieved: z.number(),
      cveDataRetrieved: z.number().optional(),
      codeExamplesRetrieved: z.number().optional(),
      hasCVEData: z.boolean().optional(),
      hasKEVs: z.boolean().optional(),
      hasExploits: z.boolean().optional(),
    }),
    enrichmentStats: z.object({
      wasEnriched: z.boolean(),
      newExamples: z.number(),
    }),
  }),
  execute: async ({ inputData, mastra }) => {
    // Dynamic import to access closePgClient
    const { closePgClient } = await import('../lib/retrieval.js');

    try {
      // Use CVE-aware analysis if CVEs are present, otherwise use standard analysis
      if (inputData.hasCVEs && inputData.cveIds.length > 0) {
        console.log(`🔍 Using CVE-aware analysis for ${inputData.cveIds.length} CVE(s)...`);

        const cveAnalysisResult = await cveAnalysisTool.execute({
          context: {
            scanData: inputData.scanData,
          },
          runId: crypto.randomUUID(),
          runtimeContext: {},
        } as any);

        return {
          ...cveAnalysisResult,
          enrichmentStats: {
            wasEnriched: inputData.enrichmentPerformed,
            newExamples: inputData.codeExamplesInserted,
          },
        };
      } else {
        console.log('📊 Using standard analysis (no CVEs detected)...');

        // Use the standard analyze-scan-tool
        const analysisResult = await analyzeScanTool.execute({
          context: {
            scanData: inputData.scanData,
          },
          runId: crypto.randomUUID(),
          runtimeContext: {},
        } as any);

        return {
          ...analysisResult,
          enrichmentStats: {
            wasEnriched: inputData.enrichmentPerformed,
            newExamples: inputData.codeExamplesInserted,
          },
        };
      }
    } finally {
      // Ensure PostgreSQL connection is closed
      await closePgClient();
      console.log('✅ Database connection closed');
    }
  },
});

// ============================================================================
// Workflow Definition
// ============================================================================

export const scanAnalysisWorkflow = createWorkflow({
  id: 'scan-analysis-workflow',
  description: 'Intelligent vulnerability scan analysis with automatic database enrichment',
  inputSchema: z.object({
    scanData: z.string().describe('Raw vulnerability scan JSON'),
  }),
  outputSchema: z.object({
    scanContext: z.string(),
    securityContext: z.string(),

    // PHASE 2: Structured code examples for frontend
    codeExamples: z.array(z.object({
      cwe_id: z.string(),
      language: z.string(),
      example_type: z.enum(['vulnerable', 'fixed', 'exploit']),
      code: z.string(),
      explanation: z.string(),
      source_url: z.string().optional(),
    })),

    metadata: z.object({
      totalFindings: z.number(),
      uniqueRules: z.number(),
      owaspEntriesRetrieved: z.number(),
      cweEntriesRetrieved: z.number(),
      cveDataRetrieved: z.number().optional(),
      codeExamplesRetrieved: z.number().optional(),
      hasCVEData: z.boolean().optional(),
      hasKEVs: z.boolean().optional(),
      hasExploits: z.boolean().optional(),
      hasBreaches: z.boolean().optional(),
      exploitsRetrieved: z.number().optional(),
      trivialExploits: z.number().optional(),
      metasploitModules: z.number().optional(),
      exploitsSeenInWild: z.number().optional(),
      breachesRetrieved: z.number().optional(),
      totalBreachCost: z.number().optional(),
      totalRecordsCompromised: z.number().optional(),
    }),
    enrichmentStats: z.object({
      wasEnriched: z.boolean(),
      newExamples: z.number(),
    }),
  }),
})
  // Step 1: Extract metadata
  .then(extractScanMetadataStep)

  // Step 2: Prepare coverage check data
  .map(async ({ inputData }) => ({
    cwes: inputData.cwes,
    owaspIds: inputData.owaspIds,
    ecosystems: inputData.ecosystems,
    cveIds: inputData.cveIds,
    hasCVEs: inputData.hasCVEs,
  }), { id: 'prepare-coverage-check' })

  // Step 3: Check database coverage
  .then(checkDatabaseCoverageStep)

  // Step 4: Conditional branching - enrich if needed
  .branch([
    // Path A: Needs enrichment
    [
      async ({ inputData }) => inputData.needsEnrichment === true,
      enrichDatabaseStep,
    ],
    // Path B: Skip enrichment
    [
      async ({ inputData }) => inputData.needsEnrichment === false,
      skipEnrichmentStep,
    ],
  ])

  // Step 5: Prepare data for analysis
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData();

    return {
      scanData: initData.scanData,
      enrichmentPerformed: inputData.enrichmentPerformed,
      codeExamplesInserted: inputData.codeExamplesInserted,
      hasCVEs: inputData.hasCVEs || false,
      cveIds: inputData.cveIds || [],
    };
  }, { id: 'prepare-analysis-data' })

  // Step 6: Generate CVE-aware analysis with enriched data
  .then(generateAnalysisStep)

  .commit();

