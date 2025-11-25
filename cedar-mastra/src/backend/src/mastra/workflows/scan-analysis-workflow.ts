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
import { plannerAgent, PlannerOutput } from '../agents/plannerAgent';
import { writerAgent } from '../agents/writerAgent';

// ============================================================================
// Step 0: Fetch Scan Results by ID
// ============================================================================

const fetchScanResultsStep = createStep({
  id: 'fetch-scan-results',
  description: 'Fetch vulnerability scan results from the scanner API by scan ID',
  inputSchema: z.object({
    scanId: z.string().describe('The UUID of the scan to fetch results for'),
  }),
  outputSchema: z.object({
    scanData: z.string().describe('Raw vulnerability scan JSON'),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    const { scanId } = inputData;

    try {
      // Get scanner service credentials from environment
      const scannerUrl = process.env.SCANNER_SERVICE_URL || 'http://web-api:8000';
      const username = process.env.SCANNER_USERNAME || 'MICS295';
      const password = process.env.SCANNER_PASSWORD || 'MaryMcHale';

      logger?.info(`🔍 Fetching scan results for ID: ${scanId}`);

      // First authenticate to get a token
      let authResponse;
      try {
        logger?.info(`Attempting to authenticate with scanner service at ${scannerUrl}/api/auth/login`);
        // Add timeout to fetch requests (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        try {
          authResponse = await fetch(`${scannerUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (fetchError) {
        const errorDetails = fetchError instanceof Error ? fetchError.message : String(fetchError);
        const errorName = fetchError instanceof Error ? fetchError.name : 'Unknown';
        logger?.error(`Failed to connect to scanner service: ${errorName} - ${errorDetails}`);
        throw new Error(`Failed to connect to scanner service at ${scannerUrl}: ${errorName} - ${errorDetails}`);
      }

      if (!authResponse.ok) {
        const errorText = await authResponse.text().catch(() => 'Unknown error');
        throw new Error(`Authentication failed: ${authResponse.status} - ${errorText}`);
      }

      const authData = await authResponse.json();
      const token = authData.access_token;

      // Now fetch the scan results
      let resultsResponse;
      try {
        logger?.info(`Fetching scan results from ${scannerUrl}/api/scan/${scanId}/findings`);
        // Add timeout to fetch requests (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        try {
          resultsResponse = await fetch(`${scannerUrl}/api/scan/${scanId}/findings`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (fetchError) {
        const errorDetails = fetchError instanceof Error ? fetchError.message : String(fetchError);
        const errorName = fetchError instanceof Error ? fetchError.name : 'Unknown';
        logger?.error(`Failed to fetch scan results: ${errorName} - ${errorDetails}`);
        throw new Error(`Failed to fetch scan results: ${errorName} - ${errorDetails}`);
      }

      if (!resultsResponse.ok) {
        if (resultsResponse.status === 404) {
          throw new Error(`Scan ID ${scanId} not found`);
        }
        const errorText = await resultsResponse.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch scan results: ${resultsResponse.status} - ${errorText}`);
      }

      const scanResults = await resultsResponse.json();

      logger?.info(`✅ Retrieved ${scanResults.findings?.length || 0} findings for scan ${scanId}`);

      // Ensure the scan data is properly formatted
      const formattedScanData = {
        findings: scanResults.findings || [],
        scan_id: scanId,
        api_base_url: scanResults.api_base_url,
        scan_date: scanResults.scan_date,
        total: scanResults.findings?.length || 0,
      };

      // Return as JSON string for the next step
      return {
        scanData: JSON.stringify(formattedScanData),
      };

    } catch (error) {
      const errorMsg = `Failed to fetch scan results: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger?.error('❌ Error fetching scan results:', { error: errorMsg });
      throw new Error(errorMsg);
    }
  },
});

// ============================================================================
// Step 1: Extract Metadata from Scan
// ============================================================================

const extractScanMetadataStep = createStep({
  id: 'extract-scan-metadata',
  description: 'Parse scan results and extract CVE/CWE/OWASP metadata',
  inputSchema: z.object({
    scanData: z.string().describe('Raw vulnerability scan JSON from previous step'),
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
  execute: async ({ inputData, mastra, getStepResult }) => {
    const logger = mastra?.getLogger();
    let scan: RawScanResult;

    logger?.info('🔍 Step 1: Extracting scan metadata...');

    // Get scanData from the previous fetch-scan-results step
    const fetchStepResult = getStepResult('fetch-scan-results');
    const scanDataFromFetch = fetchStepResult?.scanData || inputData.scanData;

    // Helper function to clean malformed JSON
    function cleanMalformedJSON(jsonStr: string): string {
      // First check if this looks like a Python dict vs JSON
      if (jsonStr.includes("'") && !jsonStr.includes('"')) {
        // Looks like Python dict, convert it
        jsonStr = jsonStr
          // Replace Python None with null
          .replace(/\bNone\b/g, 'null')
          // Replace Python True with true
          .replace(/\bTrue\b/g, 'true')
          // Replace Python False with false
          .replace(/\bFalse\b/g, 'false')
          // Replace single quotes with double quotes
          .replace(/'/g, '"');
      }

      // Fix Python byte string markers (b") that appear from truncated scanner output
      // These can appear in multiple contexts:
      // 1. At the end of strings: "text b"}
      // 2. Between objects: }b"},{
      // 3. In values: "value": b"text"

      // Pattern 1: Remove b" before closing braces/brackets/commas
      jsonStr = jsonStr.replace(/\s*b"(\}|\]|,)/g, '...$1');

      // Pattern 2: Remove b" between closing and opening braces (}b"},{"rule")
      jsonStr = jsonStr.replace(/\}b"\},\{/g, '}...,{');

      // Pattern 3: Clean up any remaining standalone b" patterns
      jsonStr = jsonStr.replace(/([^\\])b"/g, '$1..."');

      // Pattern 4: Remove Python byte string prefixes (b'...' or b"...")
      jsonStr = jsonStr.replace(/\bb'([^']*)'/g, '"$1"')
                       .replace(/\bb"([^"\\]*)"/g, '"$1"');

      return jsonStr;
    }

    // Handle both string and object inputs
    if (typeof scanDataFromFetch === 'string') {
      try {
        // Log first 500 chars to help debug JSON issues
        logger?.debug('Parsing scan data (first 500 chars)', {
          preview: scanDataFromFetch.substring(0, 500)
        });

        // First try standard JSON parsing
        try {
          scan = JSON.parse(scanDataFromFetch);
          logger?.info('✅ Successfully parsed as standard JSON');
        } catch (jsonError) {
          // If standard JSON parsing fails, try cleaning malformed JSON
          logger?.info('Standard JSON parsing failed, attempting to clean malformed JSON...');

          // Log the problematic section around the error position
          const errorPos = (jsonError as any).message?.match(/position (\d+)/)?.[1];
          if (errorPos) {
            const pos = parseInt(errorPos);
            const contextStart = Math.max(0, pos - 50);
            const contextEnd = Math.min(scanDataFromFetch.length, pos + 50);
            logger?.debug('Error context', {
              before: scanDataFromFetch.substring(contextStart, pos),
              at: scanDataFromFetch.substring(pos, pos + 1),
              after: scanDataFromFetch.substring(pos + 1, contextEnd),
              errorMessage: (jsonError as Error).message
            });

            // Check if this is the specific b" truncation issue
            const context = scanDataFromFetch.substring(contextStart, contextEnd);
            if (context.includes('b"')) {
              logger?.info('Detected byte string markers (b") in JSON - likely from truncated scanner output');
            }
          }

          const cleanedJson = cleanMalformedJSON(scanDataFromFetch);
          scan = JSON.parse(cleanedJson);
          logger?.info('✅ Successfully cleaned and parsed malformed JSON');
        }
      } catch (error) {
        const errorMsg = `Invalid scan data: Expected JSON format with "findings" array. Parse error: ${(error as Error).message}`;
        logger?.error('❌ JSON parsing failed even after Python dict conversion', {
          error: errorMsg,
          position: scanDataFromFetch.substring(Math.max(0, 900), Math.min(scanDataFromFetch.length, 920))
        });
        throw new Error(errorMsg);
      }
    } else if (typeof scanDataFromFetch === 'object' && scanDataFromFetch !== null) {
      // Already an object - use directly
      scan = scanDataFromFetch as RawScanResult;
      logger?.debug('Scan data is already an object');
    } else {
      const errorMsg = 'Invalid scan data: Expected JSON string or object with "findings" array';
      logger?.error('❌ Invalid scan data type', { type: typeof scanDataFromFetch });
      throw new Error(errorMsg);
    }

    const processed = preprocessScan(scan);

    // Extract unique identifiers
    const cwes = extractUniqueCWEs(processed);
    const owaspIds = extractUniqueOWASPIds(processed);
    const cveIds = extractCVEIds(processed);

    // Determine ecosystems from scan metadata (if available)
    // Default to 'npm' (JavaScript/Node.js) as most APIs are JavaScript-based
    // This ensures enrichment runs even when ecosystem can't be detected
    const ecosystems: string[] = ['npm'];

    // TODO: Future enhancement - detect ecosystem from scan metadata:
    // - Parse API paths for technology indicators (/api/v1 suggests REST)
    // - Check OpenAPI spec for framework hints (Express, FastAPI, Spring)
    // - Analyze endpoint patterns for language-specific conventions

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
      severities: { ...processed.summary.severityBreakdown } as Record<string, number>,
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
    scanData: z.string(), // Add scanData to input
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
    scanData: z.string(), // Pass scanData through
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('📊 Step 2: Checking database coverage...');

    // Skip database check if no DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      logger?.warn('⚠️  No DATABASE_URL configured, skipping coverage check');
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
      ssl: {
        rejectUnauthorized: false, // Accept self-signed certificates in development
      },
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
      logger?.error('❌ Database connection error:', error);
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
    cveIds: z.array(z.string()).optional(),
    hasCVEs: z.boolean().optional(),
    scanData: z.string().optional(), // Pass through scanData
  }),
  outputSchema: z.object({
    enrichmentPerformed: z.boolean(),
    advisoriesProcessed: z.number(),
    codeExamplesInserted: z.number(),
    cveIds: z.array(z.string()),
    hasCVEs: z.boolean(),
    scanData: z.string().optional(), // Pass through scanData
  }),
  execute: async ({ inputData, mastra }) => {
    const cveIds = inputData.cveIds || [];
    const hasCVEs = inputData.hasCVEs || false;

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
    const logger = mastra?.getLogger();
    logger?.info('🚀 Step 5: Generating security analysis...');

    // Dynamic import to access closePgClient
    const { closePgClient } = await import('../lib/retrieval.js');

    try {
      // Use CVE-aware analysis if CVEs are present, otherwise use standard analysis
      if (inputData.hasCVEs && inputData.cveIds.length > 0) {
        logger?.info(`🔍 Using CVE-aware analysis for ${inputData.cveIds.length} CVE(s): ${inputData.cveIds.join(', ')}`);

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
        logger?.info('📊 Using standard analysis (no CVEs detected)...');

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
    } catch (error) {
      const errorMsg = `Failed to generate analysis: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger?.error('❌ Analysis generation failed', {
        error: errorMsg,
        hasCVEs: inputData.hasCVEs,
        cveCount: inputData.cveIds?.length || 0
      });
      throw new Error(errorMsg);
    } finally {
      // Ensure PostgreSQL connection is closed
      await closePgClient();
      logger?.info('✅ Database connection closed');
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
    scanId: z.string().describe('The UUID of the scan to analyze'),
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

    // NEW: Planner-writer outputs
    plannerInsights: z.object({
      question: z.string(),
      insights: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
    userResponse: z.string().describe('Concise, mobile-optimized markdown report generated by writer agent'),
  }),
})
  // Step 0: Fetch scan results by ID
  .then(fetchScanResultsStep)

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

  // Step 5: Prepare data for analysis - create a proper step
  .then(createStep({
    id: 'prepare-analysis-data',
    description: 'Prepare data for analysis step',
    inputSchema: z.object({
      enrichmentPerformed: z.boolean(),
      codeExamplesInserted: z.number(),
      hasCVEs: z.boolean(),
      cveIds: z.array(z.string()),
      scanData: z.string().optional(), // This should come through the pipeline
    }),
    outputSchema: z.object({
      scanData: z.string(),
      enrichmentPerformed: z.boolean(),
      codeExamplesInserted: z.number(),
      hasCVEs: z.boolean(),
      cveIds: z.array(z.string()),
    }),
    execute: async ({ inputData, getStepResult }) => {
      // Get scanData from the fetch-scan-results step
      const fetchStepResult = getStepResult('fetch-scan-results');
      const scanData = fetchStepResult?.scanData;

      if (!scanData) {
        throw new Error('scanData not available from fetch-scan-results step');
      }

      return {
        scanData: scanData,
        enrichmentPerformed: inputData.enrichmentPerformed,
        codeExamplesInserted: inputData.codeExamplesInserted,
        hasCVEs: inputData.hasCVEs || false,
        cveIds: inputData.cveIds || [],
      };
    },
  }))

  // Step 6: Generate CVE-aware analysis with enriched data
  .then(generateAnalysisStep)

  // Step 7: Two-stage planner-writer response generation
  .then(createStep({
    id: 'generate-user-response',
    description: 'Generate concise user-facing response using planner-writer pattern',
    inputSchema: z.object({
      scanContext: z.string(),
      securityContext: z.string(),
      codeExamples: z.array(z.any()),
      metadata: z.object({
        totalFindings: z.number(),
        uniqueRules: z.number(),
        owaspEntriesRetrieved: z.number(),
        cweEntriesRetrieved: z.number(),
        cveDataRetrieved: z.number().optional(),
        codeExamplesRetrieved: z.number().optional(),
      }),
      enrichmentStats: z.object({
        wasEnriched: z.boolean(),
        newExamples: z.number(),
      }),
    }),
    outputSchema: z.object({
      // Pass through all original fields for backward compatibility
      scanContext: z.string(),
      securityContext: z.string(),
      codeExamples: z.array(z.any()),
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
      // NEW: Planner-writer outputs
      plannerInsights: z.object({
        question: z.string(),
        insights: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
      userResponse: z.string(),
    }),
    execute: async ({ inputData, mastra }) => {
      const logger = mastra?.getLogger();
      logger?.info('📝 Step 7: Generating user-facing response with planner-writer pattern...');

      try {
        // Stage 1: Call planner agent to extract insights
        logger?.info('🧠 Stage 1: Planner extracting insights...');

        const plannerPrompt = `Analyze this security scan and extract structured insights.

Scan Summary:
- Total Findings: ${inputData.metadata.totalFindings}
- Unique Vulnerability Types: ${inputData.metadata.uniqueRules}
- OWASP Categories Retrieved: ${inputData.metadata.owaspEntriesRetrieved}
- CWE Entries Retrieved: ${inputData.metadata.cweEntriesRetrieved}
${inputData.metadata.cveDataRetrieved ? `- CVE Data Retrieved: ${inputData.metadata.cveDataRetrieved}` : ''}
${inputData.metadata.codeExamplesRetrieved ? `- Code Examples Available: ${inputData.metadata.codeExamplesRetrieved}` : ''}

Scan Context (Vulnerability Details):
${inputData.scanContext}

Security Intelligence (OWASP/CWE):
${inputData.securityContext.substring(0, 2000)}${inputData.securityContext.length > 2000 ? '...' : ''}

Return JSON with question, insights (3-5), and recommendations (3).`;

        const plannerResult = await plannerAgent.generate(plannerPrompt);

        let plannerJson: PlannerOutput;
        try {
          plannerJson = JSON.parse(plannerResult.text);
          logger?.info(`✅ Planner extracted ${plannerJson.insights.length} insights and ${plannerJson.recommendations.length} recommendations`);
        } catch (parseError) {
          logger?.error('❌ Failed to parse planner JSON, using fallback structure', { error: parseError });
          // Fallback structure if JSON parsing fails
          plannerJson = {
            question: "What are the critical vulnerabilities in this scan?",
            insights: [
              `Found ${inputData.metadata.totalFindings} security findings across ${inputData.metadata.uniqueRules} vulnerability types`,
              "Detailed analysis available in security intelligence database",
              `Database enrichment ${inputData.enrichmentStats.wasEnriched ? `added ${inputData.enrichmentStats.newExamples} new code examples` : 'was not needed'}`
            ],
            recommendations: [
              "Review critical and high severity findings immediately",
              "Implement recommended fixes within documented timelines",
              "Verify fixes after implementation"
            ]
          };
        }

        // Stage 2: Call writer agent to generate user-friendly response
        logger?.info('✍️  Stage 2: Writer generating user-friendly markdown...');

        const writerPrompt = `Generate a concise security report for a side panel UI.

Planner Insights (Internal Notes):
${JSON.stringify(plannerJson, null, 2)}

Additional Context:
- Total Findings: ${inputData.metadata.totalFindings}
- Unique Vulnerability Types: ${inputData.metadata.uniqueRules}
- Code Examples Available: ${inputData.codeExamples.length}
${inputData.metadata.cveDataRetrieved ? `- CVE Data: ${inputData.metadata.cveDataRetrieved} entries` : ''}
${inputData.metadata.hasCVEData ? '- Real CVE data included in analysis' : ''}
${inputData.metadata.hasKEVs ? '- Known Exploited Vulnerabilities (KEVs) detected' : ''}
${inputData.metadata.hasExploits ? `- Exploit intelligence: ${inputData.metadata.exploitsRetrieved} exploits found` : ''}

Write following your instructions (concise, mobile-optimized, max 5 bullets in Next Steps).`;

        const writerResult = await writerAgent.generate(writerPrompt);

        logger?.info(`✅ Writer generated ${writerResult.text.length} character response`);

        return {
          // Pass through original workflow outputs
          ...inputData,
          // Add planner-writer outputs
          plannerInsights: plannerJson,
          userResponse: writerResult.text,
        };
      } catch (error) {
        const errorMsg = `Failed to generate user response: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger?.error('❌ Planner-writer stage failed', { error: errorMsg });

        // Fallback: Return original data without user response
        return {
          ...inputData,
          plannerInsights: {
            question: "Analysis error occurred",
            insights: ["Failed to generate structured insights"],
            recommendations: ["Please review raw scan data"]
          },
          userResponse: `# Security Analysis

Failed to generate formatted response. Please review the scan results directly.

**Summary**: ${inputData.metadata.totalFindings} findings across ${inputData.metadata.uniqueRules} vulnerability types.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }))

  .commit();

