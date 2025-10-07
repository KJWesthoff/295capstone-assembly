// Scanner Bridge Tool - Connects Mastra to your existing Python scanner service
// This tool allows the AI agent to trigger scans and fetch results

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const SCANNER_SERVICE_URL = process.env.SCANNER_SERVICE_URL || 'http://localhost:8000';

/**
 * Tool to trigger a new API security scan
 */
export const startScanTool = createTool({
  id: 'start-scan',
  description: 'Trigger a new API security scan using the scanner service',
  inputSchema: z.object({
    serverUrl: z.string().describe('Base URL of the API to scan'),
    specUrl: z.string().optional().describe('URL to OpenAPI/Swagger specification'),
    scanners: z.array(z.string()).default(['ventiapi']).describe('Scanner engines to use'),
    dangerous: z.boolean().default(false).describe('Enable dangerous/destructive tests'),
    fuzzAuth: z.boolean().default(false).describe('Enable authentication fuzzing'),
  }),
  outputSchema: z.object({
    scanId: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { serverUrl, specUrl, scanners, dangerous, fuzzAuth } = context;

    try {
      const response = await fetch(`${SCANNER_SERVICE_URL}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_url: serverUrl,
          spec_url: specUrl,
          scanners,
          dangerous,
          fuzz_auth: fuzzAuth,
          rps: 1.0,
          max_requests: 100,
        }),
      });

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        scanId: data.scan_id,
        status: 'started',
        message: `Scan initiated successfully. Scan ID: ${data.scan_id}`,
      };
    } catch (error) {
      console.error('Error starting scan:', error);
      throw new Error(`Failed to start scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Tool to check the status of a running scan
 */
export const getScanStatusTool = createTool({
  id: 'get-scan-status',
  description: 'Check the status of a running security scan',
  inputSchema: z.object({
    scanId: z.string().describe('The ID of the scan to check'),
  }),
  outputSchema: z.object({
    scanId: z.string(),
    status: z.string(),
    progress: z.number().optional(),
    findingsCount: z.number().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { scanId } = context;

    try {
      const response = await fetch(`${SCANNER_SERVICE_URL}/api/scan/${scanId}/status`);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        scanId,
        status: data.status,
        progress: data.progress,
        findingsCount: data.findings_count,
        message: `Scan ${data.status}. ${data.findings_count || 0} findings detected.`,
      };
    } catch (error) {
      console.error('Error checking scan status:', error);
      throw new Error(`Failed to check scan status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Tool to fetch findings from a completed scan
 */
export const getScanFindingsTool = createTool({
  id: 'get-scan-findings',
  description: 'Retrieve vulnerability findings from a completed security scan',
  inputSchema: z.object({
    scanId: z.string().describe('The ID of the completed scan'),
    severity: z.enum(['Critical', 'High', 'Medium', 'Low']).optional().describe('Filter by severity'),
  }),
  outputSchema: z.object({
    scanId: z.string(),
    findingsCount: z.number(),
    findings: z.array(z.any()),
    summary: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { scanId, severity } = context;

    try {
      const response = await fetch(`${SCANNER_SERVICE_URL}/api/scan/${scanId}/findings`);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}`);
      }

      const data = await response.json();
      let findings = data.findings || [];

      // Filter by severity if specified
      if (severity) {
        findings = findings.filter((f: any) => f.severity === severity);
      }

      // Calculate summary
      const summary = {
        critical: findings.filter((f: any) => f.severity === 'Critical').length,
        high: findings.filter((f: any) => f.severity === 'High').length,
        medium: findings.filter((f: any) => f.severity === 'Medium').length,
        low: findings.filter((f: any) => f.severity === 'Low').length,
      };

      return {
        scanId,
        findingsCount: findings.length,
        findings,
        summary,
      };
    } catch (error) {
      console.error('Error fetching scan findings:', error);
      throw new Error(`Failed to fetch scan findings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Export all scanner tools as a collection
 */
export const scannerTools = {
  startScanTool,
  getScanStatusTool,
  getScanFindingsTool,
};

