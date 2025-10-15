/**
 * RAG Retrieval Utilities
 * 
 * This module handles intelligent retrieval from our security intelligence database:
 * - Batch queries with metadata filtering
 * - Re-ranking for accuracy
 * - Context enrichment from multiple sources
 */

import { Client } from 'pg';
import { mistral } from '@ai-sdk/mistral';
import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { 
  rerankWithScorer, 
  MastraAgentRelevanceScorer 
} from '@mastra/rag';
import type { ProcessedScan } from './scan-processor';
import { 
  extractUniqueCWEs, 
  extractUniqueOWASPIds,
  generateScanEmbeddingText 
} from './scan-processor';

// ============================================================================
// Types
// ============================================================================

export interface RetrievalResult {
  text: string;
  score: number;
  metadata: Record<string, any>;
}

export interface EnrichedContext {
  owaspData: RetrievalResult[];
  cweData: RetrievalResult[];
  totalCWEs: number;
  totalOWASP: number;
}

export interface RetrievalConfig {
  connectionString: string;
  mistralApiKey: string;
  openaiApiKey: string;
}

// ============================================================================
// PostgreSQL Client Setup
// ============================================================================

let pgClient: Client | null = null;

export async function initializePgClient(connectionString: string): Promise<Client> {
  if (!pgClient) {
    pgClient = new Client({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    await pgClient.connect();
  }
  return pgClient;
}

export async function closePgClient(): Promise<void> {
  if (pgClient) {
    await pgClient.end();
    pgClient = null;
  }
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: mistral.embedding('mistral-embed'),
    value: query,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple queries in batch
 */
export async function generateBatchEmbeddings(queries: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: mistral.embedding('mistral-embed'),
    values: queries,
  });
  return embeddings;
}

// ============================================================================
// Batch Retrieval Functions
// ============================================================================

/**
 * Retrieve OWASP data for specific categories
 * Uses SQL with vector similarity search and filtering
 */
export async function retrieveOWASPData(
  client: Client,
  owaspIds: string[],
  queryEmbedding: number[],
  options: { topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { topK = 20 } = options;

  if (owaspIds.length === 0) {
    return [];
  }

  try {
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const placeholders = owaspIds.map((_, i) => `$${i + 2}`).join(',');
    
    const query = `
      SELECT 
        owasp_id,
        category,
        description,
        mitigations,
        related_cwes,
        related_cves,
        url,
        1 - (vector_embedding <=> $1::vector) AS similarity_score
      FROM owasp_top10
      WHERE owasp_id = ANY($2::text[])
      ORDER BY vector_embedding <=> $1::vector
      LIMIT ${topK}
    `;

    const result = await client.query(query, [vectorString, owaspIds]);

    return result.rows.map(row => ({
      text: row.description || '',
      score: parseFloat(row.similarity_score) || 0,
      metadata: {
        owasp_id: row.owasp_id,
        category: row.category,
        description: row.description,
        mitigations: row.mitigations,
        related_cwes: row.related_cwes || [],
        related_cves: row.related_cves || [],
        url: row.url,
        text: row.description || '', // Required for re-ranking
      },
    }));
  } catch (error) {
    console.error('Error retrieving OWASP data:', error);
    return [];
  }
}

/**
 * Retrieve CWE data for specific weakness IDs
 * Uses SQL with vector similarity search and filtering
 */
export async function retrieveCWEData(
  client: Client,
  cweIds: string[],
  queryEmbedding: number[],
  options: { topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { topK = 30 } = options;

  if (cweIds.length === 0) {
    return [];
  }

  try {
    const vectorString = `[${queryEmbedding.join(',')}]`;
    
    const query = `
      SELECT 
        cwe_id,
        name,
        description,
        extended_description,
        consequences,
        mitigations,
        detection_methods,
        examples,
        related_cves,
        relationships,
        url,
        1 - (vector_embedding <=> $1::vector) AS similarity_score
      FROM cwe_database
      WHERE cwe_id = ANY($2::text[])
      ORDER BY vector_embedding <=> $1::vector
      LIMIT ${topK}
    `;

    const result = await client.query(query, [vectorString, cweIds]);

    return result.rows.map(row => ({
      text: row.description || '',
      score: parseFloat(row.similarity_score) || 0,
      metadata: {
        cwe_id: row.cwe_id,
        name: row.name,
        description: row.description,
        extended_description: row.extended_description,
        consequences: row.consequences,
        mitigations: row.mitigations,
        detection_methods: row.detection_methods,
        examples: row.examples || [],
        related_cves: row.related_cves || [],
        relationships: row.relationships || [],
        url: row.url,
        text: row.description || '', // Required for re-ranking
      },
    }));
  } catch (error) {
    console.error('Error retrieving CWE data:', error);
    return [];
  }
}

/**
 * Enrich scan with context from security intelligence database
 * Performs batch retrieval across OWASP and CWE tables
 */
export async function enrichScanWithContext(
  processed: ProcessedScan,
  config: RetrievalConfig
): Promise<EnrichedContext> {
  const client = await initializePgClient(config.connectionString);

  // Generate embedding for the entire scan context
  const scanSummary = generateScanEmbeddingText(processed);
  const queryEmbedding = await generateQueryEmbedding(scanSummary);

  // Extract unique OWASP and CWE IDs
  const owaspIds = extractUniqueOWASPIds(processed);
  const cweIds = extractUniqueCWEs(processed);

  console.log(`🔍 Retrieving context for ${owaspIds.length} OWASP categories and ${cweIds.length} CWEs...`);

  // Parallel retrieval for speed
  const [owaspData, cweData] = await Promise.all([
    retrieveOWASPData(client, owaspIds, queryEmbedding, { topK: 20 }),
    retrieveCWEData(client, cweIds, queryEmbedding, { topK: 30 }),
  ]);

  console.log(`✅ Retrieved ${owaspData.length} OWASP entries and ${cweData.length} CWE entries`);

  return {
    owaspData,
    cweData,
    totalCWEs: cweIds.length,
    totalOWASP: owaspIds.length,
  };
}

// ============================================================================
// Re-ranking Functions
// ============================================================================

/**
 * Re-rank OWASP results for scan-specific relevance
 * Uses GPT-4o-mini for cost-effective semantic scoring
 */
export async function rerankOWASPResults(
  results: RetrievalResult[],
  scanContext: string,
  options: { topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { topK = 5 } = options;

  if (results.length === 0) {
    return [];
  }

  console.log(`🎯 Re-ranking ${results.length} OWASP results...`);

  try {
    const relevanceScorer = new MastraAgentRelevanceScorer(
      'owasp-relevance-scorer',
      openai('gpt-4o-mini')
    );

    const reranked = await rerankWithScorer({
      results: results.map(r => ({
        text: r.text,
        score: r.score,
        metadata: {
          ...r.metadata,
          text: r.text, // Required for semantic scoring
        },
      })),
      query: `
        Analyze OWASP API Security findings with this context:
        ${scanContext}
        
        Prioritize entries that:
        - Directly address the vulnerabilities found in the scan
        - Provide actionable remediation guidance
        - Include real-world impact examples
        - Are specific to the API security domain
      `,
      provider: relevanceScorer,
      options: { topK },
    });

    console.log(`✅ Re-ranked to top ${reranked.length} results`);
    return reranked as RetrievalResult[];
  } catch (error) {
    console.error('Error re-ranking OWASP results:', error);
    // Fallback: return original results sorted by score
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/**
 * Re-rank CWE results for practical remediation focus
 * Emphasizes CWEs with code examples and mitigation strategies
 */
export async function rerankCWEResults(
  results: RetrievalResult[],
  scanContext: string,
  options: { topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { topK = 10 } = options;

  if (results.length === 0) {
    return [];
  }

  console.log(`🎯 Re-ranking ${results.length} CWE results...`);

  try {
    const relevanceScorer = new MastraAgentRelevanceScorer(
      'cwe-relevance-scorer',
      openai('gpt-4o-mini')
    );

    const reranked = await rerankWithScorer({
      results: results.map(r => ({
        text: r.text,
        score: r.score,
        metadata: {
          ...r.metadata,
          text: r.text, // Required for semantic scoring
        },
      })),
      query: `
        Analyze CWE weaknesses relevant to this scan:
        ${scanContext}
        
        Prioritize CWEs that:
        - Have documented exploits or real-world breach examples
        - Provide specific mitigation strategies (not just generic advice)
        - Are commonly found in API security assessments
        - Include detection methods and testing approaches
        - Have clear remediation steps for developers
      `,
      provider: relevanceScorer,
      options: { topK },
    });

    console.log(`✅ Re-ranked to top ${reranked.length} results`);
    return reranked as RetrievalResult[];
  } catch (error) {
    console.error('Error re-ranking CWE results:', error);
    // Fallback: return original results sorted by score
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/**
 * Retrieval pipeline (re-ranking disabled for now to reduce complexity and latency)
 * This is the main function to use for scan analysis
 */
export async function retrieveAndRerankContext(
  processed: ProcessedScan,
  config: RetrievalConfig,
  options: {
    owaspTopK?: number;
    cweTopK?: number;
  } = {}
): Promise<{
  owaspData: RetrievalResult[];
  cweData: RetrievalResult[];
}> {
  const { owaspTopK = 5, cweTopK = 10 } = options;

  // Just do batch retrieval (skip re-ranking for now)
  const enriched = await enrichScanWithContext(processed, config);

  // Return top-K results based on vector similarity alone
  return {
    owaspData: enriched.owaspData.slice(0, owaspTopK),
    cweData: enriched.cweData.slice(0, cweTopK),
  };
}

// ============================================================================
// Enhanced Cross-Referencing Functions
// ============================================================================

/**
 * Retrieve full CWE context with all related data in one query
 * Includes: CVEs, OWASP mappings, code examples, breach studies
 */
export async function retrieveCWEFullContext(
  client: Client,
  cweId: string
): Promise<{
  cwe: any;
  relatedCVEs: string[];
  relatedOWASP: string[];
  codeExamples: Array<{
    language: string;
    type: string;
    code: string;
    explanation: string;
  }>;
  breachStudies: Array<{
    company: string;
    date: string;
    impact: string;
  }>;
}> {
  try {
    // Query 1: Get CWE base data
    const cweQuery = `
      SELECT cwe_id, name, description, extended_description, 
             consequences, mitigations, detection_methods
      FROM cwe_database
      WHERE cwe_id = $1
    `;
    const cweResult = await client.query(cweQuery, [cweId]);
    
    if (cweResult.rows.length === 0) {
      return {
        cwe: null,
        relatedCVEs: [],
        relatedOWASP: [],
        codeExamples: [],
        breachStudies: [],
      };
    }

    // Query 2: Get related CVEs
    const cveQuery = `
      SELECT ARRAY_AGG(DISTINCT cve_id) as cve_ids
      FROM cwe_cve_mapping
      WHERE cwe_id = $1
    `;
    const cveResult = await client.query(cveQuery, [cweId]);
    const relatedCVEs = cveResult.rows[0]?.cve_ids || [];

    // Query 3: Get related OWASP categories
    const owaspQuery = `
      SELECT ARRAY_AGG(DISTINCT owasp_id) as owasp_ids
      FROM owasp_top10
      WHERE $1 = ANY(related_cwes)
    `;
    const owaspResult = await client.query(owaspQuery, [cweId]);
    const relatedOWASP = owaspResult.rows[0]?.owasp_ids || [];

    // Query 4: Get code examples
    const examplesQuery = `
      SELECT language, example_type as type, code, explanation
      FROM code_examples
      WHERE cwe_id = $1
      ORDER BY 
        CASE example_type 
          WHEN 'vulnerable' THEN 1 
          WHEN 'fixed' THEN 2 
          ELSE 3 
        END,
        language
      LIMIT 10
    `;
    const examplesResult = await client.query(examplesQuery, [cweId]);
    const codeExamples = examplesResult.rows;

    // Query 5: Get breach case studies
    const breachQuery = `
      SELECT company_name as company, incident_date as date, 
             impact_description as impact
      FROM breach_case_studies
      WHERE cwe_id = $1
      ORDER BY incident_date DESC
      LIMIT 3
    `;
    const breachResult = await client.query(breachQuery, [cweId]);
    const breachStudies = breachResult.rows;

    return {
      cwe: cweResult.rows[0],
      relatedCVEs,
      relatedOWASP,
      codeExamples,
      breachStudies,
    };
  } catch (error) {
    console.error(`Error retrieving full context for ${cweId}:`, error);
    return {
      cwe: null,
      relatedCVEs: [],
      relatedOWASP: [],
      codeExamples: [],
      breachStudies: [],
    };
  }
}

/**
 * Batch retrieve full context for multiple CWEs
 * Optimized for performance with parallel queries
 */
export async function retrieveMultipleCWEFullContexts(
  client: Client,
  cweIds: string[]
): Promise<Map<string, any>> {
  const results = new Map();

  // Process in parallel with Promise.all
  await Promise.all(
    cweIds.map(async (cweId) => {
      const context = await retrieveCWEFullContext(client, cweId);
      results.set(cweId, context);
    })
  );

  return results;
}

/**
 * Get code examples for specific CWEs with filtering
 */
export async function retrieveCodeExamplesForCWEs(
  client: Client,
  cweIds: string[],
  options: {
    language?: string;
    exampleType?: 'vulnerable' | 'fixed' | 'exploit';
    limit?: number;
  } = {}
): Promise<Array<{
  cwe_id: string;
  language: string;
  example_type: string;
  code: string;
  explanation: string;
  source_url?: string;
}>> {
  const { language, exampleType, limit = 50 } = options;

  let query = `
    SELECT
      cwe_id, language, example_type, code,
      explanation, source_url
    FROM code_examples
    WHERE cwe_id = ANY($1::text[])
  `;

  const params: any[] = [cweIds];
  let paramIndex = 2;

  if (language) {
    query += ` AND language = $${paramIndex}`;
    params.push(language);
    paramIndex++;
  }

  if (exampleType) {
    query += ` AND example_type = $${paramIndex}`;
    params.push(exampleType);
    paramIndex++;
  }

  query += `
    ORDER BY 
      CASE example_type 
        WHEN 'vulnerable' THEN 1 
        WHEN 'fixed' THEN 2 
        WHEN 'exploit' THEN 3 
        ELSE 4 
      END,
      cwe_id,
      language
    LIMIT ${limit}
  `;

  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving code examples:', error);
    return [];
  }
}

/**
 * Get breach case studies for analysis context
 */
export async function retrieveBreachStudiesForCWEs(
  client: Client,
  cweIds: string[],
  options: { limit?: number } = {}
): Promise<Array<{
  cwe_id: string;
  company_name: string;
  incident_date: string;
  impact_description: string;
  attack_vector: string;
  lessons_learned: string;
}>> {
  const { limit = 10 } = options;

  const query = `
    SELECT 
      cwe_id, company_name, incident_date, 
      impact_description, attack_vector, lessons_learned
    FROM breach_case_studies
    WHERE cwe_id = ANY($1::text[])
    ORDER BY incident_date DESC
    LIMIT ${limit}
  `;

  try {
    const result = await client.query(query, [cweIds]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving breach studies:', error);
    return [];
  }
}

/**
 * Enhanced retrieval with code examples and breach studies
 * Extends the standard retrieval with actionable context
 */
export async function retrieveEnhancedContext(
  processed: ProcessedScan,
  config: RetrievalConfig,
  options: {
    owaspTopK?: number;
    cweTopK?: number;
    includeCodeExamples?: boolean;
    includeBreaches?: boolean;
  } = {}
): Promise<{
  owaspData: RetrievalResult[];
  cweData: RetrievalResult[];
  codeExamples: any[];
  breachStudies: any[];
}> {
  const {
    owaspTopK = 5,
    cweTopK = 10,
    includeCodeExamples = true,
    includeBreaches = true,
  } = options;

  const client = await initializePgClient(config.connectionString);

  // Get base retrieval
  const { owaspData, cweData } = await retrieveAndRerankContext(
    processed,
    config,
    { owaspTopK, cweTopK }
  );

  // Extract CWE IDs from results
  const cweIds = [...new Set([
    ...cweData.map(r => r.metadata.cwe_id),
    ...extractUniqueCWEs(processed),
  ])];

  // Get code examples if requested
  let codeExamples: any[] = [];
  if (includeCodeExamples && cweIds.length > 0) {
    console.log(`📖 Retrieving code examples for ${cweIds.length} CWEs...`);
    codeExamples = await retrieveCodeExamplesForCWEs(client, cweIds, {
      limit: 20,
    });
    console.log(`✅ Retrieved ${codeExamples.length} code examples`);
  }

  // Get breach studies if requested
  let breachStudies: any[] = [];
  if (includeBreaches && cweIds.length > 0) {
    console.log(`📰 Retrieving breach case studies for ${cweIds.length} CWEs...`);
    breachStudies = await retrieveBreachStudiesForCWEs(client, cweIds, {
      limit: 5,
    });
    console.log(`✅ Retrieved ${breachStudies.length} breach case studies`);
  }

  return {
    owaspData,
    cweData,
    codeExamples,
    breachStudies,
  };
}

// ============================================================================
// Context Formatting for LLM
// ============================================================================

/**
 * Format retrieved OWASP data for LLM consumption
 * Creates structured, concise context
 */
export function formatOWASPContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return 'No OWASP context available.';
  }

  return results
    .map((r, i) => {
      const meta = r.metadata;
      return `
### ${i + 1}. ${meta.owasp_id}: ${meta.category}

**Description:**
${meta.description}

**Mitigations:**
${meta.mitigations || 'Not available'}

**Related CWEs:** ${meta.related_cwes?.join(', ') || 'None listed'}

**Relevance Score:** ${(r.score * 100).toFixed(1)}%
`.trim();
    })
    .join('\n\n---\n\n');
}

/**
 * Format retrieved CWE data for LLM consumption
 * Creates structured, actionable context
 */
export function formatCWEContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return 'No CWE context available.';
  }

  return results
    .map((r, i) => {
      const meta = r.metadata;
      return `
### ${i + 1}. ${meta.cwe_id}: ${meta.name}

**Description:**
${meta.description}

**Extended Description:**
${meta.extended_description || 'Not available'}

**Consequences:**
${meta.consequences || 'Not specified'}

**Mitigations:**
${meta.mitigations || 'Not available'}

**Detection Methods:**
${meta.detection_methods || 'Not specified'}

**Relevance Score:** ${(r.score * 100).toFixed(1)}%
`.trim();
    })
    .join('\n\n---\n\n');
}

/**
 * Format complete context (OWASP + CWE) for LLM
 */
export function formatCompleteContext(
  owasp: RetrievalResult[],
  cwe: RetrievalResult[]
): string {
  return `
# Security Intelligence Context

## OWASP API Security Top 10 Context

${formatOWASPContext(owasp)}

## Common Weakness Enumeration (CWE) Context

${formatCWEContext(cwe)}
`.trim();
}

// ============================================================================
// CVE-Aware Retrieval Functions (NIST NVD Integration)
// ============================================================================

/**
 * Retrieve CVE data by exact CVE ID
 * Fast O(1) lookup using B-tree index
 */
export async function retrieveCVEById(
  client: Client,
  cveId: string
): Promise<{
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  cvss_score: number;
  cvss_vector: string;
  cwe_ids: string[];
  published_date: string;
  last_modified: string;
  exploit_available: boolean;
  is_kev: boolean;
  kev_due_date?: string;
  reference_urls: string[];
  cpe_names: string[];
} | null> {
  try {
    const query = `
      SELECT
        v.cve_id,
        v.title,
        v.description,
        v.severity,
        v.cvss_score,
        v.cvss_vector,
        v.published_date,
        v.last_modified,
        v.exploit_available,
        v.is_kev,
        v.kev_due_date,
        v.reference_urls,
        v.cpe_names,
        ARRAY_AGG(DISTINCT ccm.cwe_id) FILTER (WHERE ccm.cwe_id IS NOT NULL) as cwe_ids
      FROM vulnerabilities v
      LEFT JOIN cwe_cve_mapping ccm ON v.cve_id = ccm.cve_id
      WHERE v.cve_id = $1
      GROUP BY v.cve_id, v.title, v.description, v.severity, v.cvss_score,
               v.cvss_vector, v.published_date, v.last_modified, v.exploit_available,
               v.is_kev, v.kev_due_date, v.reference_urls, v.cpe_names
    `;

    const result = await client.query(query, [cveId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`Error retrieving CVE ${cveId}:`, error);
    return null;
  }
}

/**
 * Retrieve multiple CVEs by ID in batch
 * Optimized for performance with array-based queries
 */
export async function retrieveCVEsByIds(
  client: Client,
  cveIds: string[]
): Promise<Array<{
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  cvss_score: number;
  cvss_vector: string;
  cwe_ids: string[];
  published_date: string;
  exploit_available: boolean;
  is_kev: boolean;
}>> {
  if (cveIds.length === 0) return [];

  try {
    const query = `
      SELECT
        v.cve_id,
        v.title,
        v.description,
        v.severity,
        v.cvss_score,
        v.cvss_vector,
        v.published_date,
        v.exploit_available,
        v.is_kev,
        ARRAY_AGG(DISTINCT ccm.cwe_id) FILTER (WHERE ccm.cwe_id IS NOT NULL) as cwe_ids
      FROM vulnerabilities v
      LEFT JOIN cwe_cve_mapping ccm ON v.cve_id = ccm.cve_id
      WHERE v.cve_id = ANY($1::text[])
      GROUP BY v.cve_id, v.title, v.description, v.severity, v.cvss_score,
               v.cvss_vector, v.published_date, v.exploit_available, v.is_kev
      ORDER BY v.cvss_score DESC
    `;

    const result = await client.query(query, [cveIds]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving CVEs by IDs:', error);
    return [];
  }
}

/**
 * Retrieve CVEs by CWE ID with filtering options
 * Returns CVEs associated with specific weakness types
 */
export async function retrieveCVEsByCWE(
  client: Client,
  cweId: string,
  options: {
    minCvssScore?: number;
    exploitAvailable?: boolean;
    isKev?: boolean;
    limit?: number;
  } = {}
): Promise<Array<{
  cve_id: string;
  title: string;
  severity: string;
  cvss_score: number;
  published_date: string;
  exploit_available: boolean;
}>> {
  const {
    minCvssScore = 0,
    exploitAvailable,
    isKev,
    limit = 50,
  } = options;

  try {
    let query = `
      SELECT
        v.cve_id,
        v.title,
        v.severity,
        v.cvss_score,
        v.published_date,
        v.exploit_available
      FROM vulnerabilities v
      JOIN cwe_cve_mapping ccm ON v.cve_id = ccm.cve_id
      WHERE ccm.cwe_id = $1
        AND v.cvss_score >= $2
    `;

    const params: any[] = [cweId, minCvssScore];
    let paramIndex = 3;

    if (exploitAvailable !== undefined) {
      query += ` AND v.exploit_available = $${paramIndex}`;
      params.push(exploitAvailable);
      paramIndex++;
    }

    if (isKev !== undefined) {
      query += ` AND v.is_kev = $${paramIndex}`;
      params.push(isKev);
      paramIndex++;
    }

    query += `
      ORDER BY v.cvss_score DESC, v.published_date DESC
      LIMIT ${limit}
    `;

    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`Error retrieving CVEs for CWE ${cweId}:`, error);
    return [];
  }
}

/**
 * Semantic search for CVEs using vector similarity
 * Use when exact CVE ID is unknown but you have description/symptoms
 */
export async function searchCVEsBySimilarity(
  client: Client,
  queryEmbedding: number[],
  options: {
    minCvssScore?: number;
    severities?: string[];
    exploitAvailable?: boolean;
    limit?: number;
  } = {}
): Promise<RetrievalResult[]> {
  const {
    minCvssScore = 0,
    severities,
    exploitAvailable,
    limit = 20,
  } = options;

  try {
    const vectorString = `[${queryEmbedding.join(',')}]`;

    let query = `
      SELECT
        v.cve_id,
        v.title,
        v.description,
        v.severity,
        v.cvss_score,
        v.cvss_vector,
        v.published_date,
        v.exploit_available,
        v.is_kev,
        ARRAY_AGG(DISTINCT ccm.cwe_id) FILTER (WHERE ccm.cwe_id IS NOT NULL) as cwe_ids,
        1 - (v.vector_embedding <=> $1::vector) AS similarity_score
      FROM vulnerabilities v
      LEFT JOIN cwe_cve_mapping ccm ON v.cve_id = ccm.cve_id
      WHERE v.cvss_score >= $2
    `;

    const params: any[] = [vectorString, minCvssScore];
    let paramIndex = 3;

    if (severities && severities.length > 0) {
      query += ` AND v.severity = ANY($${paramIndex}::text[])`;
      params.push(severities);
      paramIndex++;
    }

    if (exploitAvailable !== undefined) {
      query += ` AND v.exploit_available = $${paramIndex}`;
      params.push(exploitAvailable);
      paramIndex++;
    }

    query += `
      GROUP BY v.cve_id, v.title, v.description, v.severity, v.cvss_score,
               v.cvss_vector, v.published_date, v.exploit_available, v.is_kev, v.vector_embedding
      ORDER BY v.vector_embedding <=> $1::vector
      LIMIT ${limit}
    `;

    const result = await client.query(query, params);

    return result.rows.map(row => ({
      text: `${row.title}\n\n${row.description}`,
      score: parseFloat(row.similarity_score) || 0,
      metadata: {
        cve_id: row.cve_id,
        title: row.title,
        description: row.description,
        severity: row.severity,
        cvss_score: row.cvss_score,
        cvss_vector: row.cvss_vector,
        cwe_ids: row.cwe_ids || [],
        published_date: row.published_date,
        exploit_available: row.exploit_available,
        is_kev: row.is_kev,
        text: `${row.title}\n\n${row.description}`,
      },
    }));
  } catch (error) {
    console.error('Error searching CVEs by similarity:', error);
    return [];
  }
}

/**
 * Extract CVE IDs from scan findings
 * Many scanners include CVE IDs in their output
 */
export function extractCVEIds(processed: ProcessedScan): string[] {
  const cvePattern = /CVE-\d{4}-\d{4,}/gi;
  const cveIds = new Set<string>();

  // Check all prioritized findings for CVE mentions
  for (const group of processed.prioritizedFindings) {
    // Check title
    const titleMatches = group.title.match(cvePattern);
    if (titleMatches) {
      titleMatches.forEach(cve => cveIds.add(cve.toUpperCase()));
    }

    // Check description
    const descMatches = group.description.match(cvePattern);
    if (descMatches) {
      descMatches.forEach(cve => cveIds.add(cve.toUpperCase()));
    }
  }

  return Array.from(cveIds).sort();
}

// ============================================================================
// Exploit Retrieval Functions
// ============================================================================

/**
 * Retrieve exploits for specific CVE IDs
 * Links to Exploit-DB and provides exploit availability intelligence
 */
export async function retrieveExploitsByCVEIds(
  client: Client,
  cveIds: string[]
): Promise<any[]> {
  if (cveIds.length === 0) {
    return [];
  }

  try {
    const query = `
      SELECT
        exploit_id,
        cve_ids,
        title,
        description,
        published_date,
        verified,
        exploit_type,
        platform,
        difficulty,
        requires_authentication,
        requires_user_interaction,
        source_url,
        metasploit_module,
        metasploit_rank,
        seen_in_wild,
        author
      FROM exploit_database
      WHERE cve_ids && $1::varchar[]
      ORDER BY
        CASE difficulty
          WHEN 'trivial' THEN 1
          WHEN 'easy' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'hard' THEN 4
          ELSE 5
        END,
        verified DESC,
        published_date DESC
    `;

    const result = await client.query(query, [cveIds]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving exploits by CVE IDs:', error);
    return [];
  }
}

/**
 * Get exploit statistics for a set of CVEs
 * Returns counts by difficulty, platform, and type
 */
export async function getExploitStatsByCVEs(
  client: Client,
  cveIds: string[]
): Promise<{
  totalExploits: number;
  trivialCount: number;
  verifiedCount: number;
  metasploitCount: number;
  seenInWildCount: number;
  byDifficulty: Record<string, number>;
  byPlatform: Record<string, number>;
}> {
  if (cveIds.length === 0) {
    return {
      totalExploits: 0,
      trivialCount: 0,
      verifiedCount: 0,
      metasploitCount: 0,
      seenInWildCount: 0,
      byDifficulty: {},
      byPlatform: {},
    };
  }

  try {
    const query = `
      SELECT
        COUNT(*) as total_exploits,
        COUNT(*) FILTER (WHERE difficulty = 'trivial') as trivial_count,
        COUNT(*) FILTER (WHERE verified = TRUE) as verified_count,
        COUNT(*) FILTER (WHERE metasploit_module IS NOT NULL) as metasploit_count,
        COUNT(*) FILTER (WHERE seen_in_wild = TRUE) as seen_in_wild_count,
        jsonb_object_agg(
          COALESCE(difficulty, 'unknown'),
          difficulty_counts.count
        ) as by_difficulty,
        jsonb_object_agg(
          COALESCE(platform, 'unknown'),
          platform_counts.count
        ) as by_platform
      FROM exploit_database
      WHERE cve_ids && $1::varchar[]
      CROSS JOIN LATERAL (
        SELECT difficulty, COUNT(*) as count
        FROM exploit_database
        WHERE cve_ids && $1::varchar[]
        GROUP BY difficulty
      ) AS difficulty_counts
      CROSS JOIN LATERAL (
        SELECT platform, COUNT(*) as count
        FROM exploit_database
        WHERE cve_ids && $1::varchar[]
        GROUP BY platform
      ) AS platform_counts
      GROUP BY difficulty_counts.difficulty, difficulty_counts.count,
               platform_counts.platform, platform_counts.count
    `;

    const result = await client.query(query, [cveIds]);

    if (result.rows.length === 0) {
      return {
        totalExploits: 0,
        trivialCount: 0,
        verifiedCount: 0,
        metasploitCount: 0,
        seenInWildCount: 0,
        byDifficulty: {},
        byPlatform: {},
      };
    }

    const row = result.rows[0];
    return {
      totalExploits: parseInt(row.total_exploits) || 0,
      trivialCount: parseInt(row.trivial_count) || 0,
      verifiedCount: parseInt(row.verified_count) || 0,
      metasploitCount: parseInt(row.metasploit_count) || 0,
      seenInWildCount: parseInt(row.seen_in_wild_count) || 0,
      byDifficulty: row.by_difficulty || {},
      byPlatform: row.by_platform || {},
    };
  } catch (error) {
    console.error('Error getting exploit stats:', error);
    return {
      totalExploits: 0,
      trivialCount: 0,
      verifiedCount: 0,
      metasploitCount: 0,
      seenInWildCount: 0,
      byDifficulty: {},
      byPlatform: {},
    };
  }
}

/**
 * Enhanced retrieval with CVE intelligence
 * Combines OWASP/CWE data with specific CVE details from NIST NVD
 */
export async function retrieveCVEAwareContext(
  processed: ProcessedScan,
  config: RetrievalConfig,
  options: {
    owaspTopK?: number;
    cweTopK?: number;
    includeCVEDetails?: boolean;
    includeCodeExamples?: boolean;
    includeExploits?: boolean;
    includeBreaches?: boolean;
  } = {}
): Promise<{
  owaspData: RetrievalResult[];
  cweData: RetrievalResult[];
  cveData: any[];
  codeExamples: any[];
  exploitData: any[];
  exploitStats: any;
  breachData: any[];
  breachStats: any;
  hasCVEData: boolean;
  hasExploits: boolean;
  hasBreaches: boolean;
}> {
  const {
    owaspTopK = 5,
    cweTopK = 10,
    includeCVEDetails = true,
    includeCodeExamples = true,
    includeExploits = true,
    includeBreaches = true,
  } = options;

  const client = await initializePgClient(config.connectionString);

  // Get base retrieval (OWASP + CWE)
  const { owaspData, cweData } = await retrieveAndRerankContext(
    processed,
    config,
    { owaspTopK, cweTopK }
  );

  // Extract CVE IDs from scan findings
  const cveIds = extractCVEIds(processed);
  let cveData: any[] = [];
  let hasCVEData = false;

  if (includeCVEDetails && cveIds.length > 0) {
    console.log(`🔍 Found ${cveIds.length} CVE references in scan: ${cveIds.join(', ')}`);
    cveData = await retrieveCVEsByIds(client, cveIds);
    hasCVEData = cveData.length > 0;
    console.log(`✅ Retrieved detailed CVE data for ${cveData.length} CVEs`);
  }

  // Get exploit data (CRITICAL for risk assessment)
  let exploitData: any[] = [];
  let exploitStats: any = null;
  let hasExploits = false;

  if (includeExploits && cveIds.length > 0) {
    console.log(`💣 Retrieving exploit data for ${cveIds.length} CVEs...`);
    exploitData = await retrieveExploitsByCVEIds(client, cveIds);
    exploitStats = await getExploitStatsByCVEs(client, cveIds);
    hasExploits = exploitData.length > 0;

    if (hasExploits) {
      console.log(`⚠️  Found ${exploitData.length} public exploits!`);
      if (exploitStats.trivialCount > 0) {
        console.log(`   🔴 ${exploitStats.trivialCount} TRIVIAL exploits (easy to exploit!)`);
      }
      if (exploitStats.metasploitCount > 0) {
        console.log(`   🎯 ${exploitStats.metasploitCount} Metasploit modules available`);
      }
      if (exploitStats.seenInWildCount > 0) {
        console.log(`   🌍 ${exploitStats.seenInWildCount} exploits seen in the wild`);
      }
    } else {
      console.log(`✅ No public exploits found for these CVEs`);
    }
  }

  // Get breach case studies (CONTEXTUAL for real-world impact)
  let breachData: any[] = [];
  let breachStats: any = null;
  let hasBreaches = false;

  if (includeBreaches && cveIds.length > 0) {
    console.log(`🔥 Retrieving breach case studies for ${cveIds.length} CVEs...`);
    breachData = await retrieveBreachesByCVEIds(client, cveIds);
    breachStats = await getBreachStatsByCVEs(client, cveIds);
    hasBreaches = breachData.length > 0;

    if (hasBreaches) {
      console.log(`📰 Found ${breachData.length} breach case studies!`);
      if (breachStats.totalCostUsd > 0) {
        const costB = (breachStats.totalCostUsd / 1_000_000_000).toFixed(2);
        console.log(`   💰 Total cost: $${costB}B across ${breachStats.totalBreaches} incident(s)`);
      }
      if (breachStats.totalRecordsAffected > 0) {
        const recordsM = (breachStats.totalRecordsAffected / 1_000_000).toFixed(1);
        console.log(`   📊 ${recordsM}M records compromised`);
      }
    } else {
      console.log(`✅ No major breach case studies found for these CVEs`);
    }
  }

  // Get code examples (from CWEs extracted from CVEs + original CWEs)
  let codeExamples: any[] = [];
  if (includeCodeExamples) {
    const allCWEIds = new Set([
      ...extractUniqueCWEs(processed),
      ...cveData.flatMap(cve => cve.cwe_ids || []),
    ]);

    if (allCWEIds.size > 0) {
      console.log(`📖 Retrieving code examples for ${allCWEIds.size} CWEs...`);
      codeExamples = await retrieveCodeExamplesForCWEs(
        client,
        Array.from(allCWEIds),
        { limit: 20 }
      );
      console.log(`✅ Retrieved ${codeExamples.length} code examples`);
    }
  }

  return {
    owaspData,
    cweData,
    cveData,
    codeExamples,
    exploitData,
    exploitStats,
    breachData,
    breachStats,
    hasCVEData,
    hasExploits,
    hasBreaches,
  };
}

/**
 * Format CVE data for LLM consumption
 */
export function formatCVEContext(cveData: any[]): string {
  if (cveData.length === 0) {
    return 'No CVE data available.';
  }

  return cveData
    .map((cve, i) => {
      const exploitBadge = cve.exploit_available ? '⚠️ **EXPLOIT AVAILABLE**' : '';
      const kevBadge = cve.is_kev ? '🔴 **CISA KEV (Known Exploited)**' : '';

      return `
### ${i + 1}. ${cve.cve_id}: ${cve.title}

${exploitBadge} ${kevBadge}

**Severity:** ${cve.severity} (CVSS: ${cve.cvss_score})
**CVSS Vector:** ${cve.cvss_vector || 'Not available'}
**Published:** ${new Date(cve.published_date).toLocaleDateString()}
**Related CWEs:** ${cve.cwe_ids?.join(', ') || 'None'}

**Description:**
${cve.description}
`.trim();
    })
    .join('\n\n---\n\n');
}

/**
 * Format exploit data for LLM consumption
 * Shows public exploits with difficulty, platform, and Metasploit info
 */
export function formatExploitContext(exploitData: any[], exploitStats: any): string {
  if (exploitData.length === 0) {
    return '✅ **No public exploits found** - This significantly reduces attack risk.';
  }

  // Summary header
  let formatted = `🔴 **${exploitData.length} PUBLIC EXPLOIT${exploitData.length > 1 ? 'S' : ''} AVAILABLE**\n\n`;

  // Risk summary
  formatted += `**Risk Summary:**\n`;
  formatted += `- Total exploits: ${exploitStats.totalExploits}\n`;
  if (exploitStats.trivialCount > 0) {
    formatted += `- ⚠️ ${exploitStats.trivialCount} TRIVIAL difficulty (extremely easy to exploit)\n`;
  }
  if (exploitStats.metasploitCount > 0) {
    formatted += `- 🎯 ${exploitStats.metasploitCount} Metasploit modules (automated exploitation)\n`;
  }
  if (exploitStats.seenInWildCount > 0) {
    formatted += `- 🌍 ${exploitStats.seenInWildCount} seen in active attacks\n`;
  }
  formatted += `\n`;

  // Group exploits by CVE
  const exploitsByCVE = exploitData.reduce((acc, exploit) => {
    for (const cveId of exploit.cve_ids) {
      if (!acc[cveId]) {
        acc[cveId] = [];
      }
      acc[cveId].push(exploit);
    }
    return acc;
  }, {} as Record<string, any[]>);

  // Format each CVE's exploits
  for (const [cveId, exploits] of Object.entries(exploitsByCVE)) {
    formatted += `### Exploits for ${cveId}\n\n`;

    // Show top 3 most dangerous exploits per CVE
    const topExploits = exploits.slice(0, 3);

    for (const exploit of topExploits) {
      const difficultyEmoji = {
        'trivial': '🔴',
        'easy': '🟠',
        'medium': '🟡',
        'hard': '🟢',
      }[exploit.difficulty] || '⚪';

      formatted += `**${exploit.title}**\n`;
      formatted += `- Difficulty: ${difficultyEmoji} ${exploit.difficulty.toUpperCase()}\n`;
      formatted += `- Platform: ${exploit.platform}\n`;
      formatted += `- Type: ${exploit.exploit_type}\n`;

      if (exploit.metasploit_module) {
        formatted += `- 🎯 Metasploit: \`${exploit.metasploit_module}\`\n`;
      }

      if (exploit.requires_authentication) {
        formatted += `- Requires authentication: Yes\n`;
      }

      if (exploit.seen_in_wild) {
        formatted += `- ⚠️ **Active exploitation in the wild**\n`;
      }

      formatted += `- Source: ${exploit.source_url}\n`;
      formatted += `\n`;
    }

    if (exploits.length > 3) {
      formatted += `*... and ${exploits.length - 3} more exploit(s)*\n\n`;
    }
  }

  return formatted.trim();
}

// ============================================================================
// Breach Case Studies Retrieval Functions
// ============================================================================

/**
 * Retrieve breach case studies for specific CVE IDs
 * Provides real-world examples of vulnerability exploitation
 */
export async function retrieveBreachesByCVEIds(
  client: Client,
  cveIds: string[]
): Promise<any[]> {
  if (cveIds.length === 0) {
    return [];
  }

  try {
    const query = `
      SELECT
        breach_id,
        company,
        industry,
        breach_date,
        disclosure_date,
        related_cves,
        related_cwes,
        attack_type,
        attack_vector,
        root_cause,
        records_affected,
        estimated_cost_usd,
        regulatory_fines_usd,
        breach_summary,
        how_it_happened,
        what_failed,
        could_have_prevented,
        lessons_learned,
        severity,
        verified,
        featured,
        source_urls
      FROM security_breaches
      WHERE related_cves && $1::varchar[]
        AND verified = TRUE
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        estimated_cost_usd DESC NULLS LAST,
        records_affected DESC NULLS LAST
    `;

    const result = await client.query(query, [cveIds]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving breaches by CVE IDs:', error);
    return [];
  }
}

/**
 * Retrieve breach case studies for specific CWE IDs
 * Useful when CVEs aren't available but CWE patterns are
 */
export async function retrieveBreachesByCWEIds(
  client: Client,
  cweIds: string[]
): Promise<any[]> {
  if (cweIds.length === 0) {
    return [];
  }

  try {
    const query = `
      SELECT
        breach_id,
        company,
        industry,
        breach_date,
        disclosure_date,
        related_cves,
        related_cwes,
        attack_type,
        attack_vector,
        root_cause,
        records_affected,
        estimated_cost_usd,
        breach_summary,
        how_it_happened,
        lessons_learned,
        severity,
        featured
      FROM security_breaches
      WHERE related_cwes && $1::varchar[]
        AND verified = TRUE
      ORDER BY
        featured DESC,
        estimated_cost_usd DESC NULLS LAST
      LIMIT 5
    `;

    const result = await client.query(query, [cweIds]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving breaches by CWE IDs:', error);
    return [];
  }
}

/**
 * Get breach statistics for a set of CVEs
 * Returns impact metrics and industry distribution
 */
export async function getBreachStatsByCVEs(
  client: Client,
  cveIds: string[]
): Promise<{
  totalBreaches: number;
  totalRecordsAffected: number;
  totalCostUsd: number;
  averageCostUsd: number;
  byIndustry: Record<string, number>;
  bySeverity: Record<string, number>;
  featuredCount: number;
}> {
  if (cveIds.length === 0) {
    return {
      totalBreaches: 0,
      totalRecordsAffected: 0,
      totalCostUsd: 0,
      averageCostUsd: 0,
      byIndustry: {},
      bySeverity: {},
      featuredCount: 0,
    };
  }

  try {
    const query = `
      SELECT
        COUNT(*) as total_breaches,
        COALESCE(SUM(records_affected), 0) as total_records,
        COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
        COALESCE(AVG(estimated_cost_usd), 0) as avg_cost,
        COUNT(*) FILTER (WHERE featured = TRUE) as featured_count,
        jsonb_object_agg(
          COALESCE(severity, 'unknown'),
          severity_counts.count
        ) as by_severity,
        jsonb_object_agg(
          COALESCE(industry, 'unknown'),
          industry_counts.count
        ) as by_industry
      FROM security_breaches
      WHERE related_cves && $1::varchar[]
        AND verified = TRUE
      CROSS JOIN LATERAL (
        SELECT severity, COUNT(*) as count
        FROM security_breaches
        WHERE related_cves && $1::varchar[]
          AND verified = TRUE
        GROUP BY severity
      ) AS severity_counts
      CROSS JOIN LATERAL (
        SELECT industry, COUNT(*) as count
        FROM security_breaches
        WHERE related_cves && $1::varchar[]
          AND verified = TRUE
        GROUP BY industry
      ) AS industry_counts
      GROUP BY severity_counts.severity, severity_counts.count,
               industry_counts.industry, industry_counts.count
    `;

    const result = await client.query(query, [cveIds]);

    if (result.rows.length === 0) {
      return {
        totalBreaches: 0,
        totalRecordsAffected: 0,
        totalCostUsd: 0,
        averageCostUsd: 0,
        byIndustry: {},
        bySeverity: {},
        featuredCount: 0,
      };
    }

    const row = result.rows[0];
    return {
      totalBreaches: parseInt(row.total_breaches) || 0,
      totalRecordsAffected: parseInt(row.total_records) || 0,
      totalCostUsd: parseFloat(row.total_cost) || 0,
      averageCostUsd: parseFloat(row.avg_cost) || 0,
      byIndustry: row.by_industry || {},
      bySeverity: row.by_severity || {},
      featuredCount: parseInt(row.featured_count) || 0,
    };
  } catch (error) {
    console.error('Error getting breach stats:', error);
    return {
      totalBreaches: 0,
      totalRecordsAffected: 0,
      totalCostUsd: 0,
      averageCostUsd: 0,
      byIndustry: {},
      bySeverity: {},
      featuredCount: 0,
    };
  }
}

/**
 * Format breach case studies for LLM consumption
 * Shows real-world impact of security failures
 */
export function formatBreachContext(breachData: any[], breachStats: any): string {
  if (breachData.length === 0) {
    return '✅ **No major breach case studies found** - These vulnerabilities may not have caused high-profile incidents yet.';
  }

  // Summary header
  let formatted = `🔥 **${breachData.length} REAL-WORLD BREACH CASE STUD${breachData.length > 1 ? 'IES' : 'Y'}**\n\n`;

  // Impact summary
  formatted += `**Impact Summary:**\n`;
  if (breachStats.totalRecordsAffected > 0) {
    const recordsM = (breachStats.totalRecordsAffected / 1_000_000).toFixed(1);
    formatted += `- Total records compromised: ${recordsM}M\n`;
  }
  if (breachStats.totalCostUsd > 0) {
    const costB = (breachStats.totalCostUsd / 1_000_000_000).toFixed(2);
    formatted += `- Total estimated cost: $${costB}B\n`;
  }
  if (breachStats.averageCostUsd > 0) {
    const avgM = (breachStats.averageCostUsd / 1_000_000).toFixed(1);
    formatted += `- Average cost per breach: $${avgM}M\n`;
  }
  formatted += `\n`;

  // Show each breach case study
  for (const breach of breachData) {
    const costDisplay = breach.estimated_cost_usd
      ? `$${(breach.estimated_cost_usd / 1_000_000).toFixed(0)}M`
      : 'Cost unknown';
    const recordsDisplay = breach.records_affected
      ? `${(breach.records_affected / 1_000_000).toFixed(1)}M records`
      : 'Records unknown';

    formatted += `### ${breach.company} (${breach.breach_date || 'Unknown date'})\n\n`;
    formatted += `**Industry:** ${breach.industry || 'Unknown'} | `;
    formatted += `**Impact:** ${recordsDisplay}, ${costDisplay}\n\n`;
    formatted += `**What Happened:**\n${breach.breach_summary}\n\n`;

    if (breach.root_cause) {
      formatted += `**Root Cause:** ${breach.root_cause}\n\n`;
    }

    if (breach.what_failed) {
      formatted += `**What Failed:** ${breach.what_failed}\n\n`;
    }

    if (breach.could_have_prevented) {
      formatted += `**Prevention:** ${breach.could_have_prevented}\n\n`;
    }

    if (breach.lessons_learned) {
      formatted += `**Key Lessons:**\n${breach.lessons_learned}\n\n`;
    }

    formatted += `**Related:** ${breach.related_cves.join(', ') || 'No CVEs'} | ${breach.related_cwes.join(', ') || 'No CWEs'}\n\n`;
    formatted += `---\n\n`;
  }

  return formatted.trim();
}

/**
 * Format complete CVE-aware context for LLM
 * Now includes exploit intelligence and breach case studies
 */
export function formatCompleteCVEAwareContext(
  owasp: RetrievalResult[],
  cwe: RetrievalResult[],
  cve: any[],
  exploits?: any[],
  exploitStats?: any,
  breaches?: any[],
  breachStats?: any
): string {
  let context = formatCompleteContext(owasp, cwe);

  if (cve.length > 0) {
    context += `\n\n## NIST NVD CVE Details\n\n${formatCVEContext(cve)}`;
  }

  if (exploits && exploits.length > 0 && exploitStats) {
    context += `\n\n## ⚠️ PUBLIC EXPLOIT INTELLIGENCE\n\n${formatExploitContext(exploits, exploitStats)}`;
  }

  if (breaches && breaches.length > 0 && breachStats) {
    context += `\n\n## 🔥 REAL-WORLD BREACH CASE STUDIES\n\n${formatBreachContext(breaches, breachStats)}`;
  }

  return context;
}

