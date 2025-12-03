/**
 * Scan Analysis Workflow
 * 
 * This workflow orchestrates the analysis of API vulnerability scans.
 * It fetches scan results and then uses the Security Analyst Agent to analyze them.
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { preprocessScan, extractUniqueCWEs, extractUniqueOWASPIds, type RawScanResult } from '../lib/scan-processor';
import { extractCVEIds } from '../lib/retrieval';
import { analyzeScanTool } from '../tools/analyze-scan-tool';
import { cveAnalysisTool } from '../tools/cve-analysis-tool';

// ============================================================================
// Step 1: Fetch Scan Results by ID
// ============================================================================

const fetchScanResultsStep = createStep({
  id: 'fetch-scan-results',
  description: 'Fetch vulnerability scan results from the scanner API by scan ID',
  inputSchema: z.object({
    scanId: z.string().describe('The UUID of the scan to fetch results for'),
  }),
  outputSchema: z.object({
    scanData: z.string().describe('Raw vulnerability scan JSON'),
    processed: z.any(),
    cwes: z.array(z.string()),
    owaspIds: z.array(z.string()),
    cveIds: z.array(z.string()),
    ecosystems: z.array(z.string()),
    severities: z.record(z.number()),
    hasCVEs: z.boolean(),
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
        authResponse = await fetch(`${scannerUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
      } catch (connError) {
        logger?.error(`Failed to connect to scanner service: ${(connError as Error).message}`);
        throw new Error(`Could not connect to scanner service at ${scannerUrl}. Please ensure the service is running.`);
      }

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        logger?.error(`Authentication failed: ${authResponse.status} ${authResponse.statusText} - ${errorText}`);
        throw new Error(`Authentication failed: ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      const token = authData.access_token;

      // Now fetch the scan results
      const resultsResponse = await fetch(`${scannerUrl}/api/scan/${scanId}/findings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resultsResponse.ok) {
        throw new Error(`Failed to fetch scan results: ${resultsResponse.statusText}`);
      }

      const scanData = await resultsResponse.json();

      // Ensure we have a valid scan object
      let scan: RawScanResult;

      // Handle stringified JSON if necessary
      let scanDataFromFetch = scanData;

      if (typeof scanDataFromFetch === 'string') {
        try {
          scan = JSON.parse(scanDataFromFetch);
        } catch (e) {
          throw new Error('Invalid JSON');
        }
      } else {
        scan = scanDataFromFetch as RawScanResult;
      }

      const processed = preprocessScan(scan);

      // Extract unique identifiers
      const cwes = extractUniqueCWEs(processed);
      const owaspIds = extractUniqueOWASPIds(processed);
      const cveIds = extractCVEIds(processed);
      const ecosystems: string[] = ['npm']; // Default

      return {
        scanData: JSON.stringify(scan),
        processed,
        cwes,
        owaspIds,
        cveIds,
        ecosystems,
        severities: { ...processed.summary.severityBreakdown } as Record<string, number>,
        hasCVEs: cveIds.length > 0,
      };
    } catch (error) {
      logger?.error('Error fetching scan results:', error);
      throw error;
    }
  },
});

// ============================================================================
// Step 2: Analyze Scan Results
// ============================================================================

const analyzeScanStep = createStep({
  id: 'analyze-scan',
  description: 'Analyze the scan results using the security analyst agent',
  inputSchema: z.object({
    scanData: z.string(),
    processed: z.any(),
    cwes: z.array(z.string()),
    owaspIds: z.array(z.string()),
    cveIds: z.array(z.string()),
    ecosystems: z.array(z.string()),
    severities: z.record(z.number()),
    hasCVEs: z.boolean(),
  }),
  outputSchema: z.object({
    scanContext: z.string(),
    securityContext: z.string(),
    codeExamples: z.array(z.any()),
    metadata: z.object({
      totalFindings: z.number(),
      uniqueRules: z.number(),
      owaspEntriesRetrieved: z.number(),
      cweEntriesRetrieved: z.number(),
      cveDataRetrieved: z.number().optional(),
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
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🤖 Step 2: Analyzing scan results...');

    // Use cveAnalysisTool if CVEs are present, otherwise use standard analyzeScanTool
    if (inputData.hasCVEs) {
      logger?.info('🛡️  CVEs detected - using specialized CVE Analysis Tool');
      return await cveAnalysisTool.execute({
        context: {
          scanData: inputData.scanData,
        },
        runId: crypto.randomUUID(),
        runtimeContext: runtimeContext!,
      });
    } else {
      logger?.info('🔍 Standard analysis - using Analyze Scan Tool');
      const result = await analyzeScanTool.execute({
        context: {
          scanData: inputData.scanData,
        },
        runId: crypto.randomUUID(),
        runtimeContext: runtimeContext!,
      });
      logger?.info('✅ Analyze Scan Tool finished. Output keys:', Object.keys(result));
      return result;
    }
  },
});

// ============================================================================
// Workflow Definition
// ============================================================================

export const scanAnalysisWorkflow = createWorkflow({
  id: 'scan-analysis-workflow',
  description: 'Automated analysis of API vulnerability scans',
  inputSchema: z.object({
    scanId: z.string().describe('The UUID of the scan to analyze'),
  }),
  outputSchema: z.object({
    scanContext: z.string(),
    securityContext: z.string(),
    codeExamples: z.array(z.any()),
    metadata: z.object({
      totalFindings: z.number(),
      uniqueRules: z.number(),
      owaspEntriesRetrieved: z.number(),
      cweEntriesRetrieved: z.number(),
      cveDataRetrieved: z.number().optional(),
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
  }),
});

// Link steps
scanAnalysisWorkflow
  .then(fetchScanResultsStep)
  .then(analyzeScanStep)
  .commit();

