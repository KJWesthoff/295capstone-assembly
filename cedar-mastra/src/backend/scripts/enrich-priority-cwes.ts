/**
 * Priority CWE Enrichment Script
 *
 * Continuously fetches GitHub advisories for 2 hours targeting high-priority CWEs:
 * - CWE-77: Command Injection
 * - CWE-94: Code Injection
 * - CWE-502: Deserialization
 * - CWE-20: Input Validation
 * - CWE-915: XML External Entity (XXE)
 *
 * This script runs in the background and maximizes code example coverage
 * for the most common and critical vulnerability types.
 */

import 'dotenv/config';
import { Client } from 'pg';
import { embed } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const RUNTIME_HOURS = 2;
const RUNTIME_MS = RUNTIME_HOURS * 60 * 60 * 1000;
const RATE_LIMIT_DELAY = 100; // 100ms between requests (can handle 600/min with token)
const BATCH_SIZE = 100;
const CONCURRENCY_LIMIT = 15; // Process 15 advisories in parallel
const EMBEDDING_BATCH_SIZE = 5; // Generate 5 embeddings in parallel
const PARALLEL_FETCHES = 3; // Fetch 3 different ecosystem/severity combos in parallel

// Priority CWEs to focus on
const PRIORITY_CWES = ['CWE-77', 'CWE-94', 'CWE-502', 'CWE-20', 'CWE-915'];

// Ecosystems to cycle through
const ECOSYSTEMS = ['npm', 'pip', 'maven', 'nuget', 'go', 'rubygems', 'composer'];

// Severity levels to fetch (all)
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

interface GitHubAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  cwes: Array<{ cwe_id: string; name: string }>;
  published_at: string;
  updated_at: string;
  withdrawn_at: string | null;
  vulnerabilities: Array<{
    package: { ecosystem: string; name: string };
    vulnerable_version_range: string;
    patched_versions: string;
  }>;
}

interface CodeExample {
  cve_id: string;
  cwe_id: string;
  example_type: 'vulnerable' | 'fixed';
  language: string;
  code: string;
  explanation: string;
}

const ECOSYSTEM_LANGUAGE_MAP: Record<string, string> = {
  npm: 'JavaScript',
  pip: 'Python',
  maven: 'Java',
  nuget: 'C#',
  go: 'Go',
  rubygems: 'Ruby',
  rust: 'Rust',
  composer: 'PHP',
  erlang: 'Erlang',
  actions: 'GitHub Actions',
  pub: 'Dart',
  swift: 'Swift',
  other: 'Other',
};

// ============================================================================
// Statistics Tracking
// ============================================================================

interface Stats {
  startTime: Date;
  endTime?: Date;
  totalAdvisories: number;
  relevantAdvisories: number; // Contains priority CWEs
  codeExamplesInserted: number;
  apiCalls: number;
  errorCount: number;
  byEcosystem: Record<string, number>;
  byCWE: Record<string, number>;
}

const stats: Stats = {
  startTime: new Date(),
  totalAdvisories: 0,
  relevantAdvisories: 0,
  codeExamplesInserted: 0,
  apiCalls: 0,
  errorCount: 0,
  byEcosystem: {},
  byCWE: {},
};

// ============================================================================
// GitHub API Functions
// ============================================================================

async function fetchAdvisories(
  ecosystem?: string,
  severity?: string,
  page: number = 1
): Promise<GitHubAdvisory[]> {
  const params = new URLSearchParams({
    per_page: BATCH_SIZE.toString(),
    page: page.toString(),
  });

  if (ecosystem) params.append('ecosystem', ecosystem);
  if (severity) params.append('severity', severity);

  const url = `https://api.github.com/advisories?${params}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  stats.apiCalls++;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${errorBody}`);
  }

  const advisories = await response.json();
  return advisories;
}

// ============================================================================
// Database Functions
// ============================================================================

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateForEmbedding(text: string, maxTokens: number = 7500): string {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  const maxChars = maxTokens * 4;
  const parts = text.split('\n\n');

  if (parts.length >= 2) {
    const header = parts[0];
    const codeStart = parts.slice(1).join('\n\n');

    const headerTokens = estimateTokenCount(header);
    const remainingTokens = maxTokens - headerTokens - 50;
    const remainingChars = remainingTokens * 4;

    if (remainingChars > 100) {
      return `${header}\n\n${codeStart.substring(0, remainingChars)}\n\n... [truncated for embedding]`;
    }
  }

  return text.substring(0, maxChars) + '\n\n... [truncated for embedding]';
}

// Track API failures to detect capacity issues
let consecutiveAPIFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

async function generateEmbedding(text: string, retryCount: number = 0): Promise<number[]> {
  const truncatedText = truncateForEmbedding(text, 7500);
  const MAX_RETRIES = 2;

  try {
    const { embedding } = await embed({
      model: mistral.embedding('mistral-embed'),
      value: truncatedText,
    });

    // Reset failure counter on success
    consecutiveAPIFailures = 0;
    return embedding;

  } catch (error: any) {
    const errorMessage = error.message || error.toString();

    // Check for capacity/quota errors (stop immediately)
    if (errorMessage.includes('capacity exceeded') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('Service tier capacity exceeded') ||
        errorMessage.includes('rate limit exceeded')) {

      consecutiveAPIFailures++;
      console.error(`\n❌ MISTRAL API CAPACITY ERROR: ${errorMessage}`);
      console.error(`   Consecutive failures: ${consecutiveAPIFailures}/${MAX_CONSECUTIVE_FAILURES}`);

      if (consecutiveAPIFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`FATAL: Mistral API capacity exceeded after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Please wait and try again later.`);
      }

      // Wait longer with exponential backoff
      const waitTime = Math.min(60000 * Math.pow(2, consecutiveAPIFailures - 1), 300000); // Max 5 min
      console.warn(`   ⏸️  Waiting ${Math.round(waitTime / 1000)}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Retry with same text
      if (retryCount < MAX_RETRIES) {
        return generateEmbedding(text, retryCount + 1);
      }

      throw new Error('Mistral API capacity exceeded - stopping to respect API limits');
    }

    // Handle token length errors (try shorter version)
    if (errorMessage.includes('exceeding max') || errorMessage.includes('token')) {
      console.warn(`   ⚠️  Code too large for embedding, using minimal excerpt`);
      const minimal = text.substring(0, 4000);
      const { embedding } = await embed({
        model: mistral.embedding('mistral-embed'),
        value: minimal + '\n[Code excerpt for embedding only]',
      });
      consecutiveAPIFailures = 0;
      return embedding;
    }

    // Other errors - increment counter and rethrow
    consecutiveAPIFailures++;
    console.error(`   ⚠️  Embedding error (${consecutiveAPIFailures}/${MAX_CONSECUTIVE_FAILURES}): ${errorMessage}`);
    throw error;
  }
}

async function codeExampleExists(
  client: Client,
  cveId: string,
  cweId: string,
  codeHash: string
): Promise<boolean> {
  const query = `
    SELECT 1 FROM code_examples
    WHERE cve_id = $1 AND cwe_id = $2 AND md5(code) = $3
    LIMIT 1
  `;
  const result = await client.query(query, [cveId, cweId, codeHash]);
  return result.rows.length > 0;
}

async function insertCodeExample(client: Client, example: CodeExample): Promise<void> {
  const embedding = await generateEmbedding(
    `${example.explanation}\n\n${example.code}`
  );

  const query = `
    INSERT INTO code_examples (
      cve_id, cwe_id, example_type, language, framework, code, explanation, source_url, vector_embedding, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT DO NOTHING
  `;

  const vectorString = `[${embedding.join(',')}]`;

  await client.query(query, [
    example.cve_id,
    example.cwe_id,
    example.example_type,
    example.language,
    null, // framework (not extracted in this script)
    example.code,
    example.explanation,
    `https://github.com/advisories/${example.cve_id}`, // source_url
    vectorString,
  ]);
}

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
// Ingestion State Management
// ============================================================================

interface IngestionState {
  id: number;
  lastPage: number;
  totalFetched: number;
  totalInserted: number;
  exhausted: boolean;
}

async function getIngestionState(
  client: Client,
  ecosystem: string,
  severity: string
): Promise<IngestionState> {
  const result = await client.query(
    `SELECT * FROM get_ingestion_state($1, $2, $3)`,
    ['github_priority_cwes', ecosystem, severity]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to get ingestion state');
  }

  const row = result.rows[0];
  return {
    id: row.id,
    lastPage: row.last_page,
    totalFetched: row.total_fetched,
    totalInserted: row.total_inserted,
    exhausted: row.exhausted,
  };
}

async function updateIngestionState(
  client: Client,
  ecosystem: string,
  severity: string,
  lastPage: number,
  fetchedCount: number,
  insertedCount: number,
  exhausted: boolean
): Promise<void> {
  await client.query(
    `SELECT update_ingestion_state($1, $2, $3, $4, NULL, $5, $6, $7)`,
    [
      'github_priority_cwes',
      ecosystem,
      severity,
      lastPage,
      fetchedCount,
      insertedCount,
      exhausted,
    ]
  );
}

async function resetIngestionState(
  client: Client,
  ecosystem: string,
  severity: string
): Promise<void> {
  await client.query(
    `SELECT reset_ingestion_state($1, $2, $3)`,
    ['github_priority_cwes', ecosystem, severity]
  );
}

// ============================================================================
// Code Example Extraction
// ============================================================================

function extractCodeExamples(advisory: GitHubAdvisory, ecosystem: string): CodeExample[] {
  const examples: CodeExample[] = [];
  const language = ECOSYSTEM_LANGUAGE_MAP[ecosystem] || 'text';
  const cveId = advisory.cve_id || `GHSA-${advisory.ghsa_id}`;

  // Extract from description
  const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(advisory.description)) !== null) {
    const blockLang = match[1] || language;
    const code = match[2].trim();

    if (code.length < 20) continue; // Skip trivial examples

    // Determine if vulnerable or fixed based on context
    const beforeContext = advisory.description.substring(
      Math.max(0, match.index - 200),
      match.index
    ).toLowerCase();

    const isFixed = beforeContext.includes('fix') ||
                    beforeContext.includes('patch') ||
                    beforeContext.includes('mitigat') ||
                    beforeContext.includes('correct') ||
                    beforeContext.includes('safe') ||
                    beforeContext.includes('secure');

    const isVulnerable = beforeContext.includes('vulnerable') ||
                         beforeContext.includes('exploit') ||
                         beforeContext.includes('attack') ||
                         beforeContext.includes('malicious') ||
                         beforeContext.includes('unsafe');

    for (const cwe of advisory.cwes) {
      examples.push({
        cve_id: cveId,
        cwe_id: cwe.cwe_id,
        example_type: isFixed && !isVulnerable ? 'fixed' : 'vulnerable',
        language: blockLang,
        code: code,
        explanation: `This code ${isFixed ? 'shows the fix for' : 'demonstrates the vulnerability'}: ${advisory.summary}. ${isFixed ? 'The vulnerability is mitigated through proper input validation, escaping, or using safe APIs.' : 'The issue occurs when untrusted input is processed without proper validation or sanitization.'}`,
      });
    }
  }

  return examples;
}

// ============================================================================
// Processing Logic
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
        console.error(`   ⚠️  Worker error:`, error);
        results[currentIndex] = null as R;
      }
    }
  });

  await Promise.all(workers);
  return results.filter(r => r !== null);
}

/**
 * Batch process code examples with parallel embedding generation
 */
async function insertCodeExamplesParallel(
  client: Client,
  examples: CodeExample[]
): Promise<number> {
  let insertedCount = 0;

  // Process in batches to avoid overwhelming the embedding API
  for (let i = 0; i < examples.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = examples.slice(i, i + EMBEDDING_BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (example) => {
        const codeHash = crypto.createHash('md5').update(example.code).digest('hex');

        const exists = await codeExampleExists(
          client,
          example.cve_id,
          example.cwe_id,
          codeHash
        );

        if (!exists) {
          try {
            await insertCodeExample(client, example);
            stats.codeExamplesInserted++;
            stats.byCWE[example.cwe_id] = (stats.byCWE[example.cwe_id] || 0) + 1;
            return 1;
          } catch (error) {
            console.error(`   ⚠️  Failed to insert ${example.cwe_id}:`, error);
            stats.errorCount++;
            return 0;
          }
        }
        return 0;
      })
    );

    insertedCount += results.reduce((sum, r) => sum + r, 0);
  }

  return insertedCount;
}

async function processAdvisory(
  client: Client,
  advisory: GitHubAdvisory,
  ecosystem: string
): Promise<number> {
  stats.totalAdvisories++;

  // Check if any CWEs match our priority list
  const priorityCWEs = advisory.cwes.filter(cwe =>
    PRIORITY_CWES.includes(cwe.cwe_id)
  );

  if (priorityCWEs.length === 0) {
    return 0; // Skip non-priority advisories
  }

  stats.relevantAdvisories++;

  console.log(`\n📄 Processing: ${advisory.ghsa_id} (${advisory.cve_id || 'No CVE'})`);
  console.log(`   Severity: ${advisory.severity}`);
  console.log(`   Priority CWEs: ${priorityCWEs.map(c => c.cwe_id).join(', ')}`);

  // Extract code examples
  const examples = extractCodeExamples(advisory, ecosystem);

  if (examples.length === 0) {
    console.log(`   ⏭️  Skipping: No code examples found`);
    return 0;
  }

  console.log(`   📝 Found ${examples.length} code examples`);

  // Insert code examples in parallel batches
  const insertedCount = await insertCodeExamplesParallel(client, examples);

  // Update CWE-CVE mappings in parallel
  if (advisory.cve_id && priorityCWEs.length > 0) {
    await Promise.all(
      priorityCWEs.map(cwe =>
        updateCWECVEMapping(client, advisory.cve_id!, cwe.cwe_id)
      )
    );
  }

  console.log(`   ✅ Inserted ${insertedCount} new code examples`);
  return insertedCount;
}

// ============================================================================
// Main Enrichment Loop
// ============================================================================

async function enrichPriorityCWEs() {
  console.log(`\n🚀 Starting 2-Hour Priority CWE Enrichment`);
  console.log(`================================================================================`);
  console.log(`Target CWEs: ${PRIORITY_CWES.join(', ')}`);
  console.log(`Runtime: ${RUNTIME_HOURS} hours`);
  console.log(`Start time: ${stats.startTime.toISOString()}\n`);

  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN not set. Rate limits will be much lower (60/hour vs 5000/hour)\n');
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Database connected\n');

  const startTime = Date.now();
  let ecosystemIndex = 0;
  let severityIndex = 0;

  try {
    while (Date.now() - startTime < RUNTIME_MS) {
      const ecosystem = ECOSYSTEMS[ecosystemIndex];
      const severity = SEVERITIES[severityIndex];
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      const remaining = Math.round((RUNTIME_MS - (Date.now() - startTime)) / 1000 / 60);

      console.log(`\n⏰ [${elapsed}m elapsed, ${remaining}m remaining]`);

      // Get current ingestion state for this ecosystem/severity combo
      const state = await getIngestionState(client, ecosystem, severity);

      // Skip if already exhausted
      if (state.exhausted) {
        console.log(`   ⏭️  ${ecosystem}/${severity} already exhausted (fetched ${state.totalFetched}, inserted ${state.totalInserted})`);

        // Move to next combination
        severityIndex++;
        if (severityIndex >= SEVERITIES.length) {
          severityIndex = 0;
          ecosystemIndex++;
          if (ecosystemIndex >= ECOSYSTEMS.length) {
            console.log(`\n✅ All ecosystem/severity combinations exhausted!`);
            break;
          }
        }
        continue;
      }

      const page = state.lastPage;
      console.log(`📖 Fetching: ${ecosystem} / ${severity} / page ${page}...`);
      console.log(`   (Previously: ${state.totalFetched} fetched, ${state.totalInserted} inserted)`);

      try {
        const advisories = await fetchAdvisories(ecosystem, severity, page);
        const exhausted = advisories.length < BATCH_SIZE;

        if (advisories.length === 0) {
          console.log(`   ⏭️  No more advisories for ${ecosystem}/${severity}`);

          // Mark as exhausted in database
          await updateIngestionState(client, ecosystem, severity, page, 0, 0, true);

          // Move to next combination
          severityIndex++;
          if (severityIndex >= SEVERITIES.length) {
            severityIndex = 0;
            ecosystemIndex++;
            if (ecosystemIndex >= ECOSYSTEMS.length) {
              console.log(`\n✅ All ecosystem/severity combinations exhausted!`);
              break;
            }
          }

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          continue;
        }

        console.log(`📦 Retrieved ${advisories.length} advisories${exhausted ? ' (LAST PAGE)' : ''}`);
        stats.byEcosystem[ecosystem] = (stats.byEcosystem[ecosystem] || 0) + advisories.length;

        // Process advisories in parallel with concurrency limit
        let results: number[];
        try {
          results = await processInParallel(
            advisories,
            async (advisory) => {
              try {
                return await processAdvisory(client, advisory, ecosystem);
              } catch (error: any) {
                // Check if it's a fatal API capacity error
                if (error.message?.includes('FATAL: Mistral API capacity exceeded')) {
                  console.error(`\n🛑 STOPPING: Mistral API capacity exceeded`);
                  throw error; // Propagate fatal error to stop the script
                }
                console.error(`❌ Error processing ${advisory.ghsa_id}:`, error);
                stats.errorCount++;
                return 0;
              }
            },
            CONCURRENCY_LIMIT
          );
        } catch (error: any) {
          // Fatal API error - save state and exit gracefully
          if (error.message?.includes('FATAL: Mistral API capacity exceeded')) {
            console.error(`\n🛑 GRACEFUL SHUTDOWN: Mistral API capacity exceeded`);
            console.error(`   Progress has been saved. You can resume later by running the script again.`);
            console.error(`   Current state: ${ecosystem}/${severity}/page ${page}`);
            break; // Exit the main loop
          }
          throw error; // Re-throw other errors
        }

        const totalInserted = results.reduce((sum, r) => sum + r, 0);
        console.log(`   ⚡ Processed ${advisories.length} advisories in parallel (inserted ${totalInserted} examples)`);

        // Update ingestion state in database
        await updateIngestionState(
          client,
          ecosystem,
          severity,
          page + 1, // Next page to fetch
          advisories.length,
          totalInserted,
          exhausted
        );

        // Print current stats
        console.log(`\n📊 Current Stats:`);
        console.log(`   Total advisories processed: ${stats.totalAdvisories}`);
        console.log(`   Relevant advisories (priority CWEs): ${stats.relevantAdvisories}`);
        console.log(`   Code examples inserted: ${stats.codeExamplesInserted}`);
        console.log(`   API calls: ${stats.apiCalls}`);
        console.log(`   Errors: ${stats.errorCount}`);
        console.log(`   Processing rate: ${Math.round(stats.codeExamplesInserted / ((Date.now() - startTime) / 1000 / 60))} examples/min`);

        // If exhausted, move to next combination
        if (exhausted) {
          console.log(`   ✅ Reached end of ${ecosystem}/${severity}`);
          severityIndex++;
          if (severityIndex >= SEVERITIES.length) {
            severityIndex = 0;
            ecosystemIndex++;
            if (ecosystemIndex >= ECOSYSTEMS.length) {
              console.log(`\n✅ All ecosystem/severity combinations exhausted!`);
              break;
            }
          }
        }

        // Small delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

      } catch (error: any) {
        if (error.message?.includes('403') || error.message?.includes('rate limit')) {
          console.error('❌ Rate limit hit, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          console.error('❌ Error fetching advisories:', error.message);
          stats.errorCount++;
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

  } finally {
    stats.endTime = new Date();
    await client.end();

    console.log(`\n\n🎉 Enrichment Complete!`);
    console.log(`================================================================================`);
    console.log(`Start: ${stats.startTime.toISOString()}`);
    console.log(`End: ${stats.endTime.toISOString()}`);
    console.log(`Duration: ${Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000 / 60)} minutes`);
    console.log(`\nResults:`);
    console.log(`  Total advisories: ${stats.totalAdvisories}`);
    console.log(`  Relevant advisories: ${stats.relevantAdvisories}`);
    console.log(`  Code examples inserted: ${stats.codeExamplesInserted}`);
    console.log(`  API calls: ${stats.apiCalls}`);
    console.log(`  Errors: ${stats.errorCount}`);

    console.log(`\nBy Ecosystem:`);
    Object.entries(stats.byEcosystem)
      .sort(([, a], [, b]) => b - a)
      .forEach(([eco, count]) => {
        console.log(`  ${eco}: ${count}`);
      });

    console.log(`\nBy CWE (examples added):`);
    Object.entries(stats.byCWE)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cwe, count]) => {
        console.log(`  ${cwe}: ${count}`);
      });
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const resetFlag = args.includes('--reset');
const helpFlag = args.includes('--help');

if (helpFlag) {
  console.log(`
🔥 Priority CWE Enrichment Script

Fetches GitHub advisories for 2 hours targeting high-priority CWEs:
  - CWE-77: Command Injection
  - CWE-94: Code Injection
  - CWE-502: Deserialization
  - CWE-20: Input Validation
  - CWE-915: XXE/Class Pollution

Options:
  --reset    Reset all pagination state and start from page 1
  --help     Show this help message

Features:
  ✅ Parallel processing (15 advisories at once)
  ✅ Pagination tracking (resume where you left off)
  ✅ Respects GitHub API rate limits
  ✅ Auto-skips exhausted ecosystem/severity combos
  ✅ Real-time stats and progress tracking

Usage:
  # Run for 2 hours (resumes from last position)
  npx tsx scripts/enrich-priority-cwes.ts

  # Reset state and start fresh
  npx tsx scripts/enrich-priority-cwes.ts --reset

  # Run in background
  npx tsx scripts/enrich-priority-cwes.ts > logs/enrich.log 2>&1 &

Monitor progress:
  # Check ingestion state
  psql $DATABASE_URL -c "SELECT * FROM ingestion_progress WHERE source = 'github_priority_cwes';"

  # Watch code example counts
  psql $DATABASE_URL -c "SELECT cwe_id, COUNT(*) FROM code_examples GROUP BY cwe_id ORDER BY count DESC;"
`);
  process.exit(0);
}

// Reset state if requested
if (resetFlag) {
  console.log('\n🔄 Resetting all ingestion state...');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  for (const ecosystem of ECOSYSTEMS) {
    for (const severity of SEVERITIES) {
      await resetIngestionState(client, ecosystem, severity);
    }
  }

  await client.end();
  console.log('✅ All ingestion state reset to page 1\n');
}

enrichPriorityCWEs().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
