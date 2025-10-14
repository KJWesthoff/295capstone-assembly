/**
 * GitHub Security Advisory Ingestion Script
 * 
 * Fetches security advisories from GitHub's database and extracts:
 * - CVE IDs
 * - CWE mappings
 * - Vulnerable code examples
 * - Fixed code examples (from patches)
 * - Affected packages and versions
 * 
 * Data is indexed by CVE and CWE for fast cross-referencing.
 */

import 'dotenv/config';
import { Client } from 'pg';
import { embed } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface GitHubAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  cwes: Array<{
    cwe_id: string;
    name: string;
  }>;
  references: Array<{
    url: string;
    type: string; // 'WEB', 'ADVISORY', 'PACKAGE', 'FIX'
  }>;
  vulnerabilities: Array<{
    package: {
      ecosystem: string; // 'npm', 'pypi', 'maven', etc.
      name: string;
    };
    vulnerable_version_range: string;
    patched_versions: string;
  }>;
  published_at: string;
  updated_at: string;
}

interface CodeExample {
  cve_id: string | null;
  cwe_id: string;
  language: string;
  framework: string;
  example_type: 'vulnerable' | 'fixed' | 'exploit';
  code: string;
  explanation: string;
  source_url: string;
  embedding?: number[];
}

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Get from https://github.com/settings/tokens
const DATABASE_URL = process.env.DATABASE_URL;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests to respect OpenAI rate limits
const BATCH_SIZE = 100;
const CONCURRENCY_LIMIT = 3; // Process 3 advisories in parallel (reduced to avoid quota issues)

// Ecosystem to language mapping
// Based on GitHub Advisory Database ecosystem names
const ECOSYSTEM_LANGUAGE_MAP: Record<string, string> = {
  npm: 'JavaScript',
  pip: 'Python',        // GitHub uses 'pip' not 'pypi'
  maven: 'Java',
  nuget: 'C#',
  go: 'Go',
  rubygems: 'Ruby',
  rust: 'Rust',         // GitHub uses 'rust' not 'cargo'
  composer: 'PHP',
  erlang: 'Erlang',
  actions: 'GitHub Actions',
  pub: 'Dart',
  swift: 'Swift',
  other: 'Other',
};

// ============================================================================
// GitHub API Functions
// ============================================================================

/**
 * Fetch advisories from GitHub API
 * Using REST API v3 (simpler than GraphQL for this use case)
 */
async function fetchAdvisories(
  options: {
    cveId?: string;
    severity?: string;
    ecosystem?: string;
    perPage?: number;
    page?: number;
  } = {}
): Promise<GitHubAdvisory[]> {
  const { cveId, severity, ecosystem, perPage = 100, page = 1 } = options;

  const params = new URLSearchParams();
  if (cveId) params.append('cve_id', cveId);
  if (severity) params.append('severity', severity);
  if (ecosystem) params.append('ecosystem', ecosystem);
  params.append('per_page', perPage.toString());
  params.append('page', page.toString());

  const url = `${GITHUB_API_BASE}/advisories?${params.toString()}`;

  console.log(`📡 Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : '',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  // Check rate limit
  const remaining = response.headers.get('x-ratelimit-remaining');
  const resetTime = response.headers.get('x-ratelimit-reset');
  
  if (remaining && parseInt(remaining) < 10) {
    const resetDate = new Date(parseInt(resetTime || '0') * 1000);
    console.warn(`⚠️  Rate limit low: ${remaining} remaining. Resets at ${resetDate}`);
  }

  return await response.json();
}

/**
 * Fetch advisory details including description with code examples
 */
async function fetchAdvisoryDetails(ghsaId: string): Promise<string> {
  const url = `${GITHUB_API_BASE}/advisories/${ghsaId}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : '',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch ${ghsaId}: ${response.status}`);
    return '';
  }

  const data = await response.json();
  return data.description || '';
}

// ============================================================================
// Code Extraction Functions
// ============================================================================

/**
 * Extract code blocks from markdown description
 * GitHub advisories use markdown with code fences
 */
function extractCodeBlocks(markdown: string): Array<{
  language: string;
  code: string;
}> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string }> = [];

  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();
    
    if (code.length > 10) { // Filter out tiny snippets
      blocks.push({ language, code });
    }
  }

  return blocks;
}

/**
 * Determine if code block is vulnerable or fixed based on context
 */
function determineCodeType(
  code: string,
  description: string,
  blockIndex: number
): 'vulnerable' | 'fixed' {
  const beforeCode = description.substring(
    Math.max(0, description.indexOf(code) - 200),
    description.indexOf(code)
  ).toLowerCase();

  // Keywords indicating vulnerable code
  const vulnerableKeywords = [
    'vulnerable', 
    'affected', 
    'before', 
    'bad', 
    'incorrect',
    'issue',
    'problem',
    'exploit'
  ];

  // Keywords indicating fixed code
  const fixedKeywords = [
    'fix', 
    'patch', 
    'correct', 
    'after', 
    'updated',
    'safe',
    'secure',
    'remediat'
  ];

  const vulnerableScore = vulnerableKeywords.filter(kw => 
    beforeCode.includes(kw)
  ).length;

  const fixedScore = fixedKeywords.filter(kw => 
    beforeCode.includes(kw)
  ).length;

  // Heuristic: First code block is usually vulnerable, later ones are fixes
  if (fixedScore > vulnerableScore) return 'fixed';
  if (vulnerableScore > fixedScore) return 'vulnerable';
  return blockIndex === 0 ? 'vulnerable' : 'fixed';
}

/**
 * Extract code examples from advisory
 */
async function extractCodeExamples(
  advisory: GitHubAdvisory,
  description: string
): Promise<CodeExample[]> {
  const examples: CodeExample[] = [];
  const codeBlocks = extractCodeBlocks(description);

  if (codeBlocks.length === 0) {
    return examples;
  }

  // Determine primary ecosystem/language
  const ecosystem = advisory.vulnerabilities[0]?.package.ecosystem || 'unknown';
  const language = ECOSYSTEM_LANGUAGE_MAP[ecosystem] || 'Unknown';
  const framework = advisory.vulnerabilities[0]?.package.name || '';

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const exampleType = determineCodeType(block.code, description, i);

    // Generate explanation based on surrounding context
    const explanation = generateExplanation(
      advisory.summary,
      exampleType,
      block.code
    );

    // Create example for each CWE (if advisory has multiple CWEs)
    for (const cwe of advisory.cwes) {
      examples.push({
        cve_id: advisory.cve_id,
        cwe_id: cwe.cwe_id,
        language: block.language || language,
        framework,
        example_type: exampleType,
        code: block.code,
        explanation,
        source_url: `https://github.com/advisories/${advisory.ghsa_id}`,
      });
    }
  }

  return examples;
}

/**
 * Generate human-readable explanation for code example
 */
function generateExplanation(
  summary: string,
  type: 'vulnerable' | 'fixed',
  code: string
): string {
  if (type === 'vulnerable') {
    return `This code demonstrates the vulnerability: ${summary}. ` +
           `The issue occurs when untrusted input is processed without proper validation or sanitization.`;
  } else {
    return `This code shows the fix for: ${summary}. ` +
           `The vulnerability is mitigated through proper input validation, escaping, or using safe APIs.`;
  }
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Initialize PostgreSQL connection
 */
async function initializeDatabase(): Promise<Client> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
  });

  await client.connect();
  return client;
}

/**
 * Check if code example already exists
 */
async function codeExampleExists(
  client: Client,
  cveId: string | null,
  cweId: string,
  codeHash: string
): Promise<boolean> {
  const query = `
    SELECT id FROM code_examples
    WHERE (cve_id = $1 OR ($1 IS NULL AND cve_id IS NULL))
      AND cwe_id = $2
      AND md5(code) = $3
    LIMIT 1
  `;

  const result = await client.query(query, [cveId, cweId, codeHash]);
  return result.rows.length > 0;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters for code)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit while preserving key information
 */
function truncateForEmbedding(text: string, maxTokens: number = 7500): string {
  const estimatedTokens = estimateTokenCount(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate max characters (leave buffer for safety)
  const maxChars = maxTokens * 4;
  
  // Try to preserve structure: keep explanation + truncated code
  const parts = text.split('\n\n');
  
  if (parts.length >= 2) {
    // Assume first part is metadata/explanation, second part is code
    const header = parts[0];
    const codeStart = parts.slice(1).join('\n\n');
    
    const headerTokens = estimateTokenCount(header);
    const remainingTokens = maxTokens - headerTokens - 50; // buffer
    const remainingChars = remainingTokens * 4;
    
    if (remainingChars > 100) {
      return `${header}\n\n${codeStart.substring(0, remainingChars)}\n\n... [truncated for embedding]`;
    }
  }
  
  // Fallback: simple truncation
  return text.substring(0, maxChars) + '\n\n... [truncated for embedding]';
}

/**
 * Generate embedding for code example with chunking support
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate if necessary to fit within Mistral's 8192 token limit
  const truncatedText = truncateForEmbedding(text, 7500); // Use 7500 to be safe
  
  try {
    const { embedding } = await embed({
      model: mistral.embedding('mistral-embed'),
      value: truncatedText,
    });
    return embedding;
  } catch (error: any) {
    // If still too large, try with just the first 1000 characters
    if (error.message?.includes('exceeding max') || error.message?.includes('token')) {
      console.warn(`   ⚠️  Code too large for embedding, using minimal excerpt`);
      const minimal = text.substring(0, 4000); // ~1000 tokens
      const { embedding } = await embed({
        model: mistral.embedding('mistral-embed'),
        value: minimal + '\n[Code excerpt for embedding only]',
      });
      return embedding;
    }
    throw error;
  }
}

/**
 * Insert code example into database
 */
async function insertCodeExample(
  client: Client,
  example: CodeExample
): Promise<void> {
  // Generate embedding from code + explanation
  const embeddingText = `${example.language} ${example.example_type}: ${example.explanation}\n\n${example.code}`;
  const embedding = await generateEmbedding(embeddingText);

  const query = `
    INSERT INTO code_examples (
      cve_id, cwe_id, language, framework,
      example_type, code, explanation, source_url,
      vector_embedding, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT DO NOTHING
  `;

  const vectorString = `[${embedding.join(',')}]`;

  await client.query(query, [
    example.cve_id,
    example.cwe_id,
    example.language,
    example.framework,
    example.example_type,
    example.code,
    example.explanation,
    example.source_url,
    vectorString,
  ]);
}

/**
 * Update CWE-CVE mapping table
 */
async function updateCWECVEMapping(
  client: Client,
  cveId: string,
  cweId: string
): Promise<void> {
  const query = `
    INSERT INTO cwe_cve_mapping (cwe_id, cve_id, relevance_score, first_seen)
    VALUES ($1, $2, 1.0, CURRENT_DATE)
    ON CONFLICT (cwe_id, cve_id) DO NOTHING
  `;

  await client.query(query, [cweId, cveId]);
}

// ============================================================================
// Main Ingestion Logic
// ============================================================================

/**
 * Process items in parallel with concurrency limit (semaphore pattern)
 */
async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  // Create a pool of workers
  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const result = await processor(item);
        results[currentIndex] = result;
      } catch (error) {
        // Error handling done in processor
        results[currentIndex] = null as R;
      }
    }
  });

  // Wait for all workers to complete
  await Promise.all(workers);
  
  return results.filter(r => r !== null);
}

/**
 * Process a single advisory
 */
async function processAdvisory(
  client: Client,
  advisory: GitHubAdvisory
): Promise<number> {
  console.log(`\n📄 Processing: ${advisory.ghsa_id} (${advisory.cve_id || 'No CVE'})`);
  console.log(`   Severity: ${advisory.severity}`);
  console.log(`   CWEs: ${advisory.cwes.map(c => c.cwe_id).join(', ')}`);

  // Skip if no CWEs
  if (advisory.cwes.length === 0) {
    console.log(`   ⏭️  Skipping: No CWE mapping`);
    return 0;
  }

  // Fetch detailed description
  const description = await fetchAdvisoryDetails(advisory.ghsa_id);
  
  if (!description) {
    console.log(`   ⏭️  Skipping: No description`);
    return 0;
  }

  // Extract code examples
  const examples = await extractCodeExamples(advisory, description);

  if (examples.length === 0) {
    console.log(`   ⏭️  Skipping: No code examples found`);
    return 0;
  }

  console.log(`   📝 Found ${examples.length} code examples`);

  // Check existence and insert code examples in parallel
  let insertedCount = 0;
  let skippedCount = 0;
  
  const insertResults = await Promise.all(
    examples.map(async (example) => {
      const codeHash = crypto
        .createHash('md5')
        .update(example.code)
        .digest('hex');

      const exists = await codeExampleExists(
        client,
        example.cve_id,
        example.cwe_id,
        codeHash
      );

      if (!exists) {
        try {
          await insertCodeExample(client, example);
          return { inserted: true, skipped: false };
        } catch (error) {
          console.error(`   ⚠️  Failed to insert ${example.cwe_id} ${example.example_type}:`, error);
          return { inserted: false, skipped: false };
        }
      } else {
        return { inserted: false, skipped: true };
      }
    })
  );

  insertedCount = insertResults.filter(r => r.inserted).length;
  skippedCount = insertResults.filter(r => r.skipped).length;

  if (skippedCount > 0) {
    console.log(`   ⏭️  Skipped ${skippedCount} duplicate code examples`);
  }

  // Update CWE-CVE mappings in parallel
  if (advisory.cve_id) {
    await Promise.all(
      advisory.cwes.map(cwe => 
        updateCWECVEMapping(client, advisory.cve_id!, cwe.cwe_id)
      )
    );
  }

  console.log(`   ✅ Inserted ${insertedCount} new code examples`);
  return insertedCount;
}

/**
 * Get or create ingestion state for tracking pagination
 */
async function getIngestionState(
  client: Client,
  ecosystem?: string,
  severity?: string
): Promise<{
  id: number;
  lastPage: number;
  totalFetched: number;
  totalInserted: number;
  exhausted: boolean;
}> {
  const result = await client.query(
    `SELECT * FROM get_ingestion_state($1, $2, $3)`,
    ['github_advisory', ecosystem || null, severity || null]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    lastPage: row.last_page,
    totalFetched: row.total_fetched,
    totalInserted: row.total_inserted,
    exhausted: row.exhausted,
  };
}

/**
 * Update ingestion state after processing a page
 */
async function updateIngestionState(
  client: Client,
  ecosystem: string | undefined,
  severity: string | undefined,
  lastPage: number,
  fetchedCount: number,
  insertedCount: number,
  exhausted: boolean
): Promise<void> {
  await client.query(
    `SELECT update_ingestion_state($1, $2, $3, $4, NULL, $5, $6, $7)`,
    [
      'github_advisory',
      ecosystem || null,
      severity || null,
      lastPage,
      fetchedCount,
      insertedCount,
      exhausted,
    ]
  );
}

/**
 * Main ingestion function
 */
async function ingestGitHubAdvisories(
  options: {
    maxPages?: number;
    ecosystem?: string;
    severity?: string;
    reset?: boolean; // Option to start from page 1 again
  } = {}
): Promise<void> {
  const { maxPages = 10, ecosystem, severity, reset = false } = options;

  console.log('\n🚀 Starting GitHub Advisory Ingestion');
  console.log('=' .repeat(80));

  // Validate environment
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable required');
  }
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY environment variable required');
  }
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN not set. Rate limits will be much lower (60/hour vs 5000/hour)');
  }

  const client = await initializeDatabase();
  console.log('✅ Database connected');

  // Get ingestion state to resume from where we left off
  let state = await getIngestionState(client, ecosystem, severity);
  
  // Reset if requested
  if (reset) {
    console.log('🔄 Resetting ingestion state to page 1');
    await client.query(
      `SELECT reset_ingestion_state($1, $2, $3)`,
      ['github_advisory', ecosystem || null, severity || null]
    );
    state = await getIngestionState(client, ecosystem, severity);
  }

  // Check if already exhausted
  if (state.exhausted) {
    console.log('\nℹ️  All available advisories already fetched.');
    console.log(`   Total fetched: ${state.totalFetched}`);
    console.log(`   Total inserted: ${state.totalInserted}`);
    console.log('   Use --reset flag to start from page 1 again\n');
    return;
  }

  console.log('\n📊 Ingestion State:');
  console.log(`   Starting from page: ${state.lastPage}`);
  console.log(`   Previously fetched: ${state.totalFetched} advisories`);
  console.log(`   Previously inserted: ${state.totalInserted} code examples\n`);

  let totalProcessed = 0;
  let totalInserted = 0;
  let startPage = state.lastPage;

  try {
    for (let page = startPage; page < startPage + maxPages; page++) {
      console.log(`\n📖 Fetching page ${page}...`);

      const advisories = await fetchAdvisories({
        ecosystem,
        severity,
        perPage: BATCH_SIZE,
        page,
      });

      const exhausted = advisories.length < BATCH_SIZE;
      
      if (advisories.length === 0) {
        console.log('✅ No more advisories available');
        await updateIngestionState(
          client,
          ecosystem,
          severity,
          page,
          0,
          0,
          true // Mark as exhausted
        );
        break;
      }

      console.log(`📦 Retrieved ${advisories.length} advisories`);

      // Process advisories in parallel with concurrency limit
      const results = await processInParallel(
        advisories,
        async (advisory) => {
          try {
            const inserted = await processAdvisory(client, advisory);
            totalProcessed++;
            totalInserted += inserted;
            return inserted;
          } catch (error) {
            console.error(`❌ Error processing ${advisory.ghsa_id}:`, error);
            totalProcessed++;
            return 0;
          }
        },
        CONCURRENCY_LIMIT
      );

      console.log(`   ⚡ Processed ${advisories.length} advisories in parallel (concurrency: ${CONCURRENCY_LIMIT})`);
      
      // Calculate inserted count from results
      const insertedThisPage = results.reduce((sum, r) => sum + (r || 0), 0);
      
      // Update ingestion state after each page
      await updateIngestionState(
        client,
        ecosystem,
        severity,
        page + 1, // Next page to fetch
        advisories.length,
        insertedThisPage,
        exhausted
      );

      // If we got fewer results than expected, we've exhausted the data
      if (exhausted) {
        console.log(`\n✅ Reached end of available advisories (page ${page}, ${advisories.length} results)`);
        break;
      }
      
      // Small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Ingestion Complete!');
    console.log(`   Processed: ${totalProcessed} advisories (this run)`);
    console.log(`   Inserted: ${totalInserted} code examples (this run)`);
    
    // Show cumulative stats
    const finalState = await getIngestionState(client, ecosystem, severity);
    console.log('\n📊 Cumulative Stats:');
    console.log(`   Total fetched: ${finalState.totalFetched} advisories`);
    console.log(`   Total inserted: ${finalState.totalInserted} code examples`);
    console.log(`   Next page: ${finalState.lastPage}`);
    console.log(`   Exhausted: ${finalState.exhausted ? 'Yes' : 'No'}`);
    console.log('='.repeat(80) + '\n');

  } finally {
    await client.end();
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  const options: {
    maxPages?: number;
    ecosystem?: string;
    severity?: string;
  } = {
    maxPages: 10, // Default to 10 pages (1000 advisories)
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-pages':
        options.maxPages = parseInt(args[++i]);
        break;
      case '--ecosystem':
        options.ecosystem = args[++i];
        break;
      case '--severity':
        options.severity = args[++i];
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--help':
        console.log(`
Usage: npx tsx scripts/ingest-github-advisories.ts [options]

Options:
  --max-pages <n>      Maximum pages to fetch (default: 10, 100 per page)
  --ecosystem <name>   Filter by ecosystem (npm, pip, maven, etc.)
  --severity <level>   Filter by severity (low, moderate, high, critical)
  --reset              Reset pagination state and start from page 1
  --help               Show this help message

Examples:
  # Fetch 10 pages (1000 advisories) across all ecosystems
  npx tsx scripts/ingest-github-advisories.ts

  # Fetch 50 pages of npm advisories only
  npx tsx scripts/ingest-github-advisories.ts --max-pages 50 --ecosystem npm

  # Fetch only critical Python vulnerabilities
  npx tsx scripts/ingest-github-advisories.ts --ecosystem pypi --severity critical

Environment Variables Required:
  DATABASE_URL          PostgreSQL connection string
  MISTRAL_API_KEY       Mistral API key for embeddings
  GITHUB_TOKEN          (Optional) GitHub personal access token for higher rate limits
        `);
        process.exit(0);
    }
  }

  await ingestGitHubAdvisories(options);
}

// ============================================================================
// Run
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
}

export { ingestGitHubAdvisories, fetchAdvisories, extractCodeExamples };

