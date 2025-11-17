/**
 * Query GitHub Security Advisories Tool
 *
 * Searches GitHub's Security Advisory Database for specific vulnerabilities
 * and programming languages, then stores the results in the database for
 * immediate use in analysis.
 *
 * This is a targeted, context-aware enrichment tool that:
 * - Searches for specific CVEs, CWEs, or vulnerability types
 * - Filters by programming language/ecosystem
 * - Stores code examples in the database
 * - Returns results immediately to the user
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { ingestGitHubAdvisories } from '../../../scripts/ingest-github-advisories';

// Valid ecosystems supported by GitHub Advisory Database
const VALID_ECOSYSTEMS = [
  'npm',        // JavaScript/Node.js
  'pip',        // Python
  'maven',      // Java
  'nuget',      // C#/.NET
  'go',         // Go
  'rubygems',   // Ruby
  'rust',       // Rust
  'composer',   // PHP
  'erlang',     // Erlang
  'actions',    // GitHub Actions
  'pub',        // Dart
  'swift',      // Swift
  'other',      // Other/Unknown
] as const;

const VALID_SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;

export const queryGitHubAdvisoriesTool = createTool({
  id: 'query-github-advisories',
  description: `Search GitHub Security Advisories for specific vulnerabilities and store results in database.

Use this tool when:
- User asks about a specific CVE or vulnerability type
- You need code examples for a specific programming language
- User wants to see real-world examples of a vulnerability
- You need to enrich context about a finding from a scan

The tool will:
1. Query GitHub's database with specific filters
2. Extract code examples and vulnerability details
3. Store them in the database for future use
4. Return a summary of findings to you

Supported ecosystems: ${VALID_ECOSYSTEMS.join(', ')}

Examples:
- "Show me SQL injection examples in Python" → { ecosystem: "pip", keywords: ["SQL injection"] }
- "Find CVE-2023-12345" → { cveId: "CVE-2023-12345" }
- "Get SSRF examples in Node.js" → { ecosystem: "npm", keywords: ["SSRF", "server-side request forgery"] }
- "Find critical authentication bugs in Java" → { ecosystem: "maven", severity: "critical", keywords: ["authentication"] }`,

  inputSchema: z.object({
    ecosystem: z
      .enum(VALID_ECOSYSTEMS)
      .optional()
      .describe('Programming language/ecosystem (npm, pip, maven, etc.). If omitted, searches all ecosystems.'),

    cveId: z
      .string()
      .optional()
      .describe('Specific CVE ID to search for (e.g., "CVE-2023-12345")'),

    keywords: z
      .array(z.string())
      .optional()
      .describe('Keywords to search for in advisory descriptions (e.g., ["SQL injection", "authentication"])'),

    severity: z
      .enum(VALID_SEVERITIES)
      .optional()
      .describe('Filter by severity level (low, moderate, high, critical)'),

    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of advisories to fetch (default: 10, max: 100)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    advisories: z.array(
      z.object({
        id: z.string(),
        cveId: z.string().nullable(),
        summary: z.string(),
        severity: z.string(),
        ecosystem: z.string().optional(),
        url: z.string(),
      })
    ),
    stats: z.object({
      totalAdvisories: z.number(),
      backgroundIngestionTriggered: z.boolean(),
    }),
    error: z.string().optional(),
  }),

  execute: async ({ context }) => {
    const { ecosystem, cveId, keywords, severity, maxResults = 10 } = context;

    console.log(`\n🔍 Querying GitHub Security Advisories`);
    console.log(`   Ecosystem: ${ecosystem || 'all'}`);
    console.log(`   CVE: ${cveId || 'none'}`);
    console.log(`   Keywords: ${keywords?.join(', ') || 'none'}`);
    console.log(`   Severity: ${severity || 'all'}`);
    console.log(`   Max Results: ${maxResults}`);

    try {
      // Check for GITHUB_TOKEN
      if (!process.env.GITHUB_TOKEN) {
        return {
          success: false,
          message: 'GITHUB_TOKEN environment variable not set. Cannot query GitHub API.',
          advisories: [],
          stats: {
            totalAdvisories: 0,
            backgroundIngestionTriggered: false,
          },
          error: 'Missing GITHUB_TOKEN configuration',
        };
      }

      // Build GitHub API query
      const GITHUB_API_BASE = 'https://api.github.com';
      const params = new URLSearchParams();

      if (cveId) params.append('cve_id', cveId);
      if (ecosystem) params.append('ecosystem', ecosystem);
      if (severity) params.append('severity', severity);
      params.append('per_page', Math.min(maxResults, 100).toString());
      params.append('sort', 'updated'); // Most recently updated first
      params.append('direction', 'desc');

      const url = `${GITHUB_API_BASE}/advisories?${params.toString()}`;

      console.log(`📡 Fetching from GitHub API...`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      let advisories = await response.json();

      // Filter by keywords if provided
      if (keywords && keywords.length > 0) {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        advisories = advisories.filter((advisory: any) => {
          const searchText = `${advisory.summary} ${advisory.description}`.toLowerCase();
          return lowerKeywords.some(keyword => searchText.includes(keyword));
        });
        console.log(`   Filtered to ${advisories.length} advisories matching keywords`);
      }

      // Limit results
      advisories = advisories.slice(0, maxResults);

      // Format advisories for response
      const formattedAdvisories = advisories.map((adv: any) => ({
        id: adv.ghsa_id,
        cveId: adv.cve_id,
        summary: adv.summary,
        severity: adv.severity,
        ecosystem: adv.vulnerabilities?.[0]?.package?.ecosystem,
        url: `https://github.com/advisories/${adv.ghsa_id}`,
      }));

      // Format summary for immediate return
      const resultMessage = cveId
        ? `Found ${advisories.length} advisory(ies) for ${cveId}. Triggering background ingestion for future use.`
        : `Found ${advisories.length} advisories${ecosystem ? ` for ${ecosystem}` : ''}. Triggering background ingestion for future use.`;

      // Trigger background ingestion for future RAG queries (non-blocking)
      // This enriches the database with code examples and embeddings
      console.log(`💾 Triggering background ingestion for database enrichment...`);

      // Don't await - let it run in background so user gets immediate results
      ingestGitHubAdvisories({
        ecosystem,
        severity,
        maxPages: 1, // Just one page since we're targeting specific results
      }).then(() => {
        console.log(`✅ Background ingestion complete for ${ecosystem || 'all ecosystems'}`);
      }).catch((ingestionError: any) => {
        console.warn(`⚠️  Background ingestion failed: ${ingestionError.message}`);
      });

      return {
        success: true,
        message: resultMessage,
        advisories: formattedAdvisories,
        stats: {
          totalAdvisories: advisories.length,
          backgroundIngestionTriggered: true,
        },
      };

    } catch (error: any) {
      console.error('❌ Query failed:', error);

      return {
        success: false,
        message: `Failed to query GitHub advisories: ${error.message}`,
        advisories: [],
        stats: {
          totalAdvisories: 0,
          backgroundIngestionTriggered: false,
        },
        error: error.message,
      };
    }
  },
});
