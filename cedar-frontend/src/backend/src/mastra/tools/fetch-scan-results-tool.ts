/**
 * Tool to fetch scan results from the scanner API by scan ID
 *
 * This tool retrieves vulnerability scan results from the scanner service
 * when a user references a scan ID. It's used by the security analyst agent
 * to get the full scan data when users ask for analysis by scan ID.
 */

import { Tool } from '@mastra/core/tools';
import { z } from 'zod';

// Input schema
const FetchScanResultsInputSchema = z.object({
  scanId: z.string().describe('The UUID of the scan to fetch results for'),
});

// Output schema - matches the structure expected by scan-analysis-workflow
const FetchScanResultsOutputSchema = z.object({
  success: z.boolean(),
  scanData: z.object({
    findings: z.array(z.any()).describe('Array of vulnerability findings'),
    scan_id: z.string().optional(),
    api_base_url: z.string().optional(),
    scan_date: z.string().optional(),
    total_findings: z.number().optional(),
  }).optional(),
  error: z.string().optional(),
});

export const fetchScanResultsTool = new Tool({
  id: 'fetch-scan-results',
  name: 'Fetch Scan Results',
  description: 'Fetch vulnerability scan results from the scanner API by scan ID',
  inputSchema: FetchScanResultsInputSchema,
  outputSchema: FetchScanResultsOutputSchema,
  execute: async ({ context }) => {
    const { scanId } = context;

    try {
      // Get scanner service credentials from environment
      const scannerUrl = process.env.SCANNER_SERVICE_URL || 'http://web-api:8000';
      const username = process.env.SCANNER_USERNAME || 'MICS295';
      const password = process.env.SCANNER_PASSWORD || 'MaryMcHale';

      console.log(`🔍 Fetching scan results for ID: ${scanId}`);

      // First authenticate to get a token
      const authResponse = await fetch(`${scannerUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      const token = authData.access_token;

      // Now fetch the scan results
      const resultsResponse = await fetch(`${scannerUrl}/scans/${scanId}/findings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resultsResponse.ok) {
        if (resultsResponse.status === 404) {
          throw new Error(`Scan ID ${scanId} not found`);
        }
        throw new Error(`Failed to fetch scan results: ${resultsResponse.status}`);
      }

      const scanResults = await resultsResponse.json();

      console.log(`✅ Retrieved ${scanResults.findings?.length || 0} findings for scan ${scanId}`);

      // Return in the format expected by scan-analysis-workflow
      return {
        success: true,
        scanData: {
          findings: scanResults.findings || [],
          scan_id: scanId,
          api_base_url: scanResults.api_base_url,
          scan_date: scanResults.scan_date,
          total_findings: scanResults.findings?.length || 0,
        },
      };

    } catch (error) {
      console.error(`❌ Error fetching scan results:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});