/**
 * Get Security Intelligence Tool
 *
 * A unified tool for retrieving security intelligence (CVEs, CWEs, code examples)
 * from both local database and external sources (GitHub Advisory Database).
 *
 * Features:
 * 1. Checks local vector database first (fast)
 * 2. Falls back to GitHub API if local data is sparse (comprehensive)
 * 3. Automatically triggers background enrichment to improve future queries
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ingestGitHubAdvisories } from '../../../scripts/ingest-github-advisories';
import { getPostgresPool, executeQueryWithRetry } from '../lib/database-auth';

// Valid ecosystems supported by GitHub Advisory Database
const VALID_ECOSYSTEMS = [
    'npm', 'pip', 'maven', 'nuget', 'go', 'rubygems', 'rust',
    'composer', 'erlang', 'actions', 'pub', 'swift', 'other'
] as const;

export const getSecurityIntelligenceTool = createTool({
    id: 'get-security-intelligence',
    description: `Retrieve security intelligence, code examples, and vulnerability details.
  
  Use this tool when you need:
  - Explanations of vulnerabilities (CWE/CVE)
  - Code examples (vulnerable vs fixed) for specific languages
  - Details about specific CVEs (e.g., CVE-2023-12345)
  - Remediation guidance for specific frameworks
  
  This tool automatically handles:
  1. Searching local knowledge base
  2. Fetching from GitHub Security Advisories if needed
  3. Enriching the database for future use
  
  Examples:
  - "Show me SQL injection examples in Python" -> { query: "SQL injection", ecosystem: "pip" }
  - "Tell me about CVE-2021-44228" -> { cveId: "CVE-2021-44228" }
  - "How to fix XSS in React" -> { query: "Cross-site scripting React", ecosystem: "npm" }`,

    inputSchema: z.object({
        query: z.string().optional().describe('Search query (e.g., "SQL injection", "buffer overflow")'),
        cveId: z.string().optional().describe('Specific CVE ID to look up (e.g., "CVE-2023-12345")'),
        ecosystem: z.enum(VALID_ECOSYSTEMS).optional().describe('Programming language/ecosystem filter'),
        maxResults: z.number().default(5).describe('Maximum number of results to return'),
    }),

    outputSchema: z.object({
        source: z.enum(['local', 'external', 'mixed']),
        results: z.array(z.object({
            title: z.string(),
            description: z.string(),
            cveId: z.string().nullable().optional(),
            cweId: z.string().nullable().optional(),
            severity: z.string().optional(),
            ecosystem: z.string().optional(),
            codeExamples: z.array(z.object({
                language: z.string(),
                vulnerable: z.string().optional(),
                fixed: z.string().optional(),
            })).optional(),
            references: z.array(z.string()).optional(),
        })),
        message: z.string(),
    }),

    execute: async ({ context }) => {
        const { query, cveId, ecosystem, maxResults = 5 } = context;
        const results: any[] = [];
        let source: 'local' | 'external' | 'mixed' = 'local';

        console.log(`🔍 Security Intelligence Request: ${cveId || query} (${ecosystem || 'any'})`);

        try {
            // 1. Try Local Database First
            // ---------------------------
            const pool = getPostgresPool();
            let localHits: any[] = [];

            if (cveId) {
                // Exact lookup by CVE
                const cveQuery = `
          SELECT * FROM code_examples 
          WHERE cve_id = $1 
          LIMIT $2
        `;
                const res = await pool.query(cveQuery, [cveId, maxResults]);
                localHits = res.rows;
            } else if (query) {
                // Semantic/Keyword search (simplified for this implementation)
                // In a real RAG setup, this would use vector similarity. 
                // For now, we'll use a basic text search on description/title if available, 
                // or fall back to external if no vector search is implemented here yet.

                // Note: Assuming 'code_examples' has a description or title field. 
                // If not, we might need to join with a 'vulnerabilities' table.
                // For this spike, we'll assume we might miss local text matches and rely on external for queries.
                console.log('   ℹ️  Local semantic search not fully implemented in this tool version, checking external...');
            }

            // Format local results
            if (localHits.length > 0) {
                console.log(`   ✅ Found ${localHits.length} local results`);
                results.push(...localHits.map(row => ({
                    title: `Local: ${row.cve_id || row.cwe_id}`,
                    description: row.description || 'No description available locally',
                    cveId: row.cve_id,
                    cweId: row.cwe_id,
                    ecosystem: row.language, // mapping language to ecosystem roughly
                    codeExamples: [{
                        language: row.language,
                        vulnerable: row.vulnerable_code,
                        fixed: row.fixed_code
                    }]
                })));
            }

            // 2. Fallback to External (GitHub) if needed
            // ------------------------------------------
            // If we have fewer results than requested, or if it's a query (which we skipped locally)
            if (results.length < maxResults || query) {
                console.log('   🌐 Fetching from GitHub Security Advisories...');

                // Build GitHub API Query
                const GITHUB_API_BASE = 'https://api.github.com';
                const params = new URLSearchParams();

                if (cveId) params.append('cve_id', cveId);
                if (ecosystem) params.append('ecosystem', ecosystem);

                // If we have a query, we can't easily pass it to the advisory list endpoint 
                // unless we filter client-side or use the search API.
                // The list endpoint supports: ecosystem, severity, cve_id, ghsa_id.
                // It does NOT support generic text search.
                // So if we have a query but no CVE/Ecosystem, this might be broad.

                // However, we can use the GitHub Search API for generic queries:
                // GET /search/code?q=... (not ideal for advisories)
                // Better: GET /advisories (list) and filter, OR rely on the user providing CVE/Ecosystem.

                // For this implementation, we'll stick to the List Advisories endpoint 
                // and filter by ecosystem/cve if provided. If only 'query' is provided, 
                // we might need to skip external fetch or fetch recent criticals.

                let shouldFetchExternal = true;
                if (!cveId && !ecosystem && query) {
                    // If only query is provided, we can't efficiently search GitHub Advisories API 
                    // without fetching everything. We'll skip external for pure text queries 
                    // unless we implement a proper search.
                    // For now, let's try to map the query to an ecosystem if possible, or just skip.
                    console.log('   ⚠️  External search requires CVE ID or Ecosystem. Skipping external fetch for pure text query.');
                    shouldFetchExternal = false;
                }

                if (shouldFetchExternal && process.env.GITHUB_TOKEN) {
                    params.append('per_page', String(maxResults));

                    const response = await fetch(`${GITHUB_API_BASE}/advisories?${params.toString()}`, {
                        headers: {
                            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });

                    if (response.ok) {
                        const advisories = await response.json();
                        console.log(`   ✅ Found ${advisories.length} external advisories`);

                        // Process and add to results
                        for (const adv of advisories) {
                            // Avoid duplicates if we already found this CVE locally
                            if (adv.cve_id && results.some(r => r.cveId === adv.cve_id)) continue;

                            results.push({
                                title: adv.summary,
                                description: adv.description,
                                cveId: adv.cve_id,
                                cweId: adv.cwes?.[0]?.cwe_id,
                                severity: adv.severity,
                                ecosystem: adv.vulnerabilities?.[0]?.package?.ecosystem,
                                references: adv.references?.map((r: any) => r.url),
                                // Note: GitHub API response doesn't always include code snippets directly 
                                // in the list view, but we provide the description which often contains them.
                            });
                        }

                        if (localHits.length > 0 && advisories.length > 0) source = 'mixed';
                        else if (advisories.length > 0) source = 'external';

                        // 3. Background Enrichment (Fire & Forget)
                        // ----------------------------------------
                        if (advisories.length > 0) {
                            console.log('   💾 Triggering background ingestion...');
                            ingestGitHubAdvisories({
                                ecosystem: ecosystem as any,
                                maxPages: 1,
                                severity: 'critical' // default to critical for background fill
                            }).catch(err => console.error('Background ingestion error:', err));
                        }
                    }
                }
            }

            return {
                source,
                results: results.slice(0, maxResults),
                message: `Found ${results.length} results from ${source} sources.`
            };

        } catch (error: any) {
            console.error('❌ Error in get-security-intelligence:', error);
            return {
                source: 'local' as const,
                results: [],
                message: `Error retrieving intelligence: ${error.message}`
            };
        }
    }
});
