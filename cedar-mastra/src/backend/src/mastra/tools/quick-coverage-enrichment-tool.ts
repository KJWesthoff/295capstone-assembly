/**
 * Quick Coverage Enrichment Tool
 * 
 * Performs FAST, minimal enrichment for immediate user response.
 * Designed for sub-30 second execution.
 * 
 * Strategy:
 * 1. Fetch only 1-2 pages (100-200 advisories, ~15-30 seconds)
 * 2. Provide immediate value to user
 * 3. Optionally trigger background job for full enrichment
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { ingestGitHubAdvisories } from '../../../scripts/ingest-github-advisories';

export const quickCoverageEnrichmentTool = createTool({
  id: 'quick-enrich-coverage',
  description: `Perform FAST enrichment of database for immediate user response.

This is the "quick mode" version of github-advisory-ingestion that:
- Fetches only 1-2 pages (100-200 advisories)
- Completes in ~15-30 seconds
- Provides immediate value to user
- Does NOT block for long periods

Use this when:
- User is waiting for analysis response
- Need some enrichment but not comprehensive
- Speed is more important than completeness

For bulk enrichment, use the full ingestion script separately.`,

  inputSchema: z.object({
    ecosystem: z
      .enum(['npm', 'pip', 'maven', 'nuget', 'go', 'rubygems', 'rust', 'composer', 'erlang', 'actions', 'pub', 'swift', 'other'])
      .describe('Package ecosystem to fetch advisories for'),
    severity: z
      .enum(['low', 'moderate', 'high', 'critical'])
      .default('critical')
      .describe('Severity filter (default: critical for fastest ingestion)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    stats: z.object({
      advisoriesProcessed: z.number(),
      codeExamplesInserted: z.number(),
      executionTimeSeconds: z.number(),
    }),
  }),

  execute: async ({ context }) => {
    const { ecosystem, severity = 'critical' } = context;
    const startTime = Date.now();

    console.log(`⚡ Quick Enrichment Mode: ${ecosystem} (${severity})`);
    console.log(`   Target: < 30 seconds`);

    try {
      // Capture stats
      let totalProcessed = 0;
      let totalInserted = 0;

      const originalConsoleLog = console.log;
      console.log = (...args: any[]) => {
        const message = args.join(' ');
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
        // Quick mode: Only 2 pages maximum (200 advisories, ~30 sec)
        await ingestGitHubAdvisories({
          ecosystem,
          severity,
          maxPages: 2, // HARD LIMIT for quick mode
        });
      } finally {
        console.log = originalConsoleLog;
      }

      const executionTime = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        message: `Quick enrichment complete in ${executionTime}s. Inserted ${totalInserted} examples. For comprehensive enrichment, run bulk ingestion separately.`,
        stats: {
          advisoriesProcessed: totalProcessed,
          codeExamplesInserted: totalInserted,
          executionTimeSeconds: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Math.round((Date.now() - startTime) / 1000);
      
      return {
        success: false,
        message: `Quick enrichment failed after ${executionTime}s: ${error.message}`,
        stats: {
          advisoriesProcessed: 0,
          codeExamplesInserted: 0,
          executionTimeSeconds: executionTime,
        },
      };
    }
  },
});

