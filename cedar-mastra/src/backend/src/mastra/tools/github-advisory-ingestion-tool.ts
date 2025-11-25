/**
 * GitHub Advisory Ingestion Tool
 * 
 * Allows agents to dynamically fetch and ingest security advisories
 * from GitHub's database for specific ecosystems and severity levels.
 * 
 * Use cases:
 * - Enriching the database when analyzing scans from specific technologies
 * - Fetching critical vulnerabilities for a particular language/framework
 * - Proactively updating the knowledge base with latest security data
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { ingestGitHubAdvisories } from '../../../scripts/ingest-github-advisories';
import { validateEnvironment } from '../lib/database-auth';

// Valid ecosystems supported by GitHub Advisory Database
// Based on: https://docs.github.com/rest/security-advisories/global-advisories#list-global-security-advisories
const VALID_ECOSYSTEMS = [
  'npm',
  'pip',        // Python (not 'pypi')
  'maven',
  'nuget',
  'go',
  'rubygems',
  'rust',       // Cargo (not 'cargo')
  'composer',
  'erlang',
  'actions',
  'pub',
  'swift',
  'other',
] as const;

const VALID_SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;

export const githubAdvisoryIngestionTool = createTool({
  id: 'ingest-github-advisories',
  description: `Ingest security advisories from GitHub's Security Advisory Database.
  
Use this tool when:
- You need code examples for a specific programming language or framework
- The database lacks sufficient code examples for vulnerabilities in a scan
- You want to enrich the knowledge base with latest CVE/CWE mappings
- A scan contains vulnerabilities from a specific ecosystem (npm, pypi, maven, etc.)

The tool fetches advisories, extracts vulnerable/fixed code examples, 
and stores them indexed by CVE/CWE for fast retrieval.

Valid ecosystems: ${VALID_ECOSYSTEMS.join(', ')}
Valid severities: ${VALID_SEVERITIES.join(', ')}

Examples:
- Fetch critical npm vulnerabilities: { ecosystem: "npm", severity: "critical" }
- Fetch all Python vulnerabilities: { ecosystem: "pip" }
- Fetch Rust vulnerabilities: { ecosystem: "rust" }
- Fetch high/critical across all ecosystems: { severity: "high", maxPages: 5 }`,

  inputSchema: z.object({
    ecosystem: z
      .enum(VALID_ECOSYSTEMS)
      .optional()
      .describe(
        'Filter by package ecosystem (npm, pypi, maven, etc.). If omitted, fetches from all ecosystems.'
      ),
    severity: z
      .enum(VALID_SEVERITIES)
      .optional()
      .describe(
        'Filter by severity level (low, moderate, high, critical). If omitted, fetches all severities.'
      ),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(3)
      .describe(
        'Number of pages to fetch (100 advisories per page). Default: 3 (300 advisories). Max: 10 (1000 advisories) to respect GitHub rate limits.'
      ),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    stats: z.object({
      advisoriesProcessed: z.number(),
      codeExamplesInserted: z.number(),
      ecosystem: z.string().optional(),
      severity: z.string().optional(),
      pagesProcessed: z.number(),
    }),
    error: z.string().optional(),
  }),

  execute: async ({ context }) => {
    const { ecosystem, severity, maxPages = 3 } = context;

    // Check for recent ingestion to prevent rapid-fire calls
    const lastIngestionKey = 'github_advisory_last_ingestion';
    const cooldownMinutes = 5; // Minimum 5 minutes between ingestions
    
    if (global[lastIngestionKey as any]) {
      const lastRun = new Date(global[lastIngestionKey as any]);
      const now = new Date();
      const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / 1000 / 60;
      
      if (minutesSinceLastRun < cooldownMinutes) {
        const remainingMinutes = Math.ceil(cooldownMinutes - minutesSinceLastRun);
        return {
          success: false,
          message: `Rate limit protection: Please wait ${remainingMinutes} minute(s) before ingesting again. Last ingestion was ${Math.floor(minutesSinceLastRun)} minute(s) ago.`,
          stats: {
            advisoriesProcessed: 0,
            codeExamplesInserted: 0,
            pagesProcessed: 0,
          },
          error: `Cooldown active: ${remainingMinutes} minutes remaining`,
        };
      }
    }

    console.log(`\n🔧 GitHub Advisory Ingestion Tool Activated`);
    console.log(`   Ecosystem: ${ecosystem || 'all'}`);
    console.log(`   Severity: ${severity || 'all'}`);
    console.log(`   Max Pages: ${maxPages} (${maxPages * 100} advisories)`);
    console.log(`   ⏰ Rate limit protection: 5 min cooldown between runs`);

    try {
      // Validate environment
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

      // Check for MISTRAL_API_KEY separately (optional for now)
      if (!process.env.MISTRAL_API_KEY) {
        return {
          success: false,
          message: 'MISTRAL_API_KEY environment variable not set',
          stats: {
            advisoriesProcessed: 0,
            codeExamplesInserted: 0,
            pagesProcessed: 0,
          },
          error: 'Missing MISTRAL_API_KEY configuration',
        };
      }

      // Track statistics
      let totalProcessed = 0;
      let totalInserted = 0;

      // Create a custom version that tracks stats
      const originalConsoleLog = console.log;
      const logs: string[] = [];

      // Intercept console.log to capture stats
      console.log = (...args: any[]) => {
        const message = args.join(' ');
        logs.push(message);
        
        // Parse statistics from logs
        if (message.includes('Processed:')) {
          const match = message.match(/Processed:\s*(\d+)/);
          if (match) totalProcessed = parseInt(match[1]);
        }
        if (message.includes('Inserted:')) {
          const match = message.match(/Inserted:\s*(\d+)/);
          if (match) totalInserted = parseInt(match[1]);
        }
        
        originalConsoleLog(...args);
      };

      try {
        // Mark ingestion start time
        global[lastIngestionKey as any] = new Date().toISOString();
        
        // Run ingestion
        await ingestGitHubAdvisories({
          ecosystem,
          severity,
          maxPages,
        });

        // Restore console.log
        console.log = originalConsoleLog;

        const resultMessage = `Successfully ingested GitHub advisories. Processed ${totalProcessed} advisories, inserted ${totalInserted} code examples. Cooldown: 5 minutes.`;

        return {
          success: true,
          message: resultMessage,
          stats: {
            advisoriesProcessed: totalProcessed,
            codeExamplesInserted: totalInserted,
            ecosystem: ecosystem || 'all',
            severity: severity || 'all',
            pagesProcessed: maxPages,
          },
        };
      } finally {
        console.log = originalConsoleLog;
      }
    } catch (error: any) {
      console.error('❌ Ingestion failed:', error);

      return {
        success: false,
        message: `Failed to ingest advisories: ${error.message}`,
        stats: {
          advisoriesProcessed: 0,
          codeExamplesInserted: 0,
          pagesProcessed: 0,
        },
        error: error.message,
      };
    }
  },
});

