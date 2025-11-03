/**
 * NIST NVD CVE Ingestion Script
 *
 * Ingests CVE records from NIST National Vulnerability Database into PostgreSQL:
 * - Reads preprocessed CVE data from Python script output
 * - Generates Mistral embeddings for CVE descriptions
 * - Inserts into vulnerabilities table with proper indexing
 * - Populates cwe_cve_mapping table for cross-referencing
 * - Updates related tables with CVE references
 *
 * Usage:
 *   pnpm tsx scripts/ingest-nist-nvd.ts --batch-size 100
 *   pnpm tsx scripts/ingest-nist-nvd.ts --incremental --input data/raw/nvd_cves_incremental.jsonl
 */

import 'dotenv/config';
import { Client } from 'pg';
import { embed, embedMany } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CVERecord {
  source: string;
  cve_id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  cvss_score: number;
  cvss_vector: string;
  cwe_ids: string[];
  published_date: string;
  last_modified: string;
  references: string[];
  cpe_names: string[];
  exploit_available: boolean;
}

interface IngestionStats {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  cweMappings: number;
  startTime: Date;
  endTime?: Date;
}

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const DEFAULT_INPUT_FILE = 'data/raw/nvd_cves.jsonl';
const BATCH_SIZE = 100; // Process 100 CVEs at a time for embeddings
const EMBEDDING_BATCH_SIZE = 50; // Generate 50 embeddings at once (Mistral limit)

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Initialize PostgreSQL client
 */
async function initializeClient(): Promise<Client> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  return client;
}

/**
 * Check if CVE already exists in database
 */
async function cveExists(client: Client, cveId: string): Promise<boolean> {
  const result = await client.query(
    'SELECT 1 FROM vulnerabilities WHERE cve_id = $1',
    [cveId]
  );
  return result.rows.length > 0;
}

/**
 * Insert or update CVE record in vulnerabilities table
 */
async function upsertCVE(
  client: Client,
  cve: CVERecord,
  embedding: number[]
): Promise<'inserted' | 'updated'> {
  const query = `
    INSERT INTO vulnerabilities (
      cve_id,
      severity,
      cvss_score,
      title,
      description,
      published_date,
      last_modified,
      vector_embedding,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    ON CONFLICT (cve_id) DO UPDATE SET
      severity = EXCLUDED.severity,
      cvss_score = EXCLUDED.cvss_score,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      last_modified = EXCLUDED.last_modified,
      vector_embedding = EXCLUDED.vector_embedding,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `;

  const result = await client.query(query, [
    cve.cve_id,
    cve.severity,
    cve.cvss_score,
    cve.title,
    cve.description,
    cve.published_date,
    cve.last_modified,
    `[${embedding.join(',')}]`, // pgvector format
  ]);

  return result.rows[0].inserted ? 'inserted' : 'updated';
}

/**
 * Insert CWE-CVE mappings
 */
async function insertCWEMappings(
  client: Client,
  cveId: string,
  cweIds: string[]
): Promise<number> {
  if (cweIds.length === 0) return 0;

  let insertedCount = 0;

  for (const cweId of cweIds) {
    try {
      await client.query(
        `
        INSERT INTO cwe_cve_mapping (cwe_id, cve_id, relevance_score, first_seen, last_updated)
        VALUES ($1, $2, 1.0, CURRENT_DATE, NOW())
        ON CONFLICT (cwe_id, cve_id) DO UPDATE SET
          last_updated = NOW()
        `,
        [cweId, cveId]
      );
      insertedCount++;
    } catch (error) {
      console.error(`Error inserting CWE mapping ${cweId} -> ${cveId}:`, error);
    }
  }

  return insertedCount;
}

/**
 * Update CWE database with related CVE
 */
async function updateCWERelatedCVEs(
  client: Client,
  cweId: string,
  cveId: string
): Promise<void> {
  try {
    await client.query(
      `
      UPDATE cwe_database
      SET
        related_cves = array_append(
          COALESCE(related_cves, ARRAY[]::TEXT[]),
          $2
        ),
        updated_at = NOW()
      WHERE cwe_id = $1
        AND NOT ($2 = ANY(COALESCE(related_cves, ARRAY[]::TEXT[])))
      `,
      [cweId, cveId]
    );
  } catch (error) {
    // CWE might not exist in database yet, ignore
  }
}

/**
 * Update ingestion state tracking
 */
async function updateIngestionState(
  client: Client,
  source: string,
  recordsProcessed: number,
  lastCVEId: string
): Promise<void> {
  await client.query(
    `
    INSERT INTO ingestion_state (source, last_updated, records_processed, last_record_id, status)
    VALUES ($1, NOW(), $2, $3, 'completed')
    ON CONFLICT (source) DO UPDATE SET
      last_updated = NOW(),
      records_processed = ingestion_state.records_processed + $2,
      last_record_id = $3,
      status = 'completed'
    `,
    [source, recordsProcessed, lastCVEId]
  );
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for CVE description
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: mistral.embedding('mistral-embed'),
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple CVEs in batch
 */
async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: mistral.embedding('mistral-embed'),
    values: texts,
  });
  return embeddings;
}

/**
 * Format CVE data for embedding (title + description + metadata)
 */
function formatCVEForEmbedding(cve: CVERecord): string {
  const parts = [
    `CVE: ${cve.cve_id}`,
    `Title: ${cve.title}`,
    `Description: ${cve.description}`,
    `Severity: ${cve.severity}`,
    `CVSS Score: ${cve.cvss_score}`,
  ];

  if (cve.cwe_ids.length > 0) {
    parts.push(`CWE IDs: ${cve.cwe_ids.join(', ')}`);
  }

  if (cve.exploit_available) {
    parts.push('Known Exploit: Available');
  }

  return parts.join('\n');
}

// ============================================================================
// Main Ingestion Logic
// ============================================================================

/**
 * Read and parse JSONL file line by line
 */
async function* readJSONL(filePath: string): AsyncGenerator<CVERecord> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        yield JSON.parse(line) as CVERecord;
      } catch (error) {
        console.error(`Error parsing line: ${line}`, error);
      }
    }
  }
}

/**
 * Ingest CVEs from JSONL file
 */
async function ingestCVEs(
  inputFile: string,
  incremental: boolean = false,
  batchSize: number = BATCH_SIZE
): Promise<IngestionStats> {
  const stats: IngestionStats = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    cweMappings: 0,
    startTime: new Date(),
  };

  const client = await initializeClient();

  try {
    console.log(`\n🔄 Starting CVE ingestion from: ${inputFile}`);
    console.log(`📊 Batch size: ${batchSize} CVEs\n`);

    let batch: CVERecord[] = [];
    let lastCVEId = '';

    for await (const cve of readJSONL(inputFile)) {
      batch.push(cve);
      lastCVEId = cve.cve_id;

      if (batch.length >= batchSize) {
        await processBatch(client, batch, stats, incremental);
        batch = [];
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await processBatch(client, batch, stats, incremental);
    }

    // Update ingestion state
    await updateIngestionState(client, 'nist_nvd', stats.total, lastCVEId);

    stats.endTime = new Date();
    return stats;

  } finally {
    await client.end();
  }
}

/**
 * Process a batch of CVEs
 */
async function processBatch(
  client: Client,
  batch: CVERecord[],
  stats: IngestionStats,
  incremental: boolean
): Promise<void> {
  console.log(`\n📦 Processing batch of ${batch.length} CVEs...`);

  // Check for existing CVEs (skip in incremental mode)
  if (!incremental) {
    const toProcess: CVERecord[] = [];
    for (const cve of batch) {
      const exists = await cveExists(client, cve.cve_id);
      if (exists) {
        stats.skipped++;
        console.log(`⏭️  Skipping ${cve.cve_id} (already exists)`);
      } else {
        toProcess.push(cve);
      }
    }
    batch = toProcess;
  }

  if (batch.length === 0) {
    console.log('✅ All CVEs in batch already exist, skipping');
    return;
  }

  // Generate embeddings in sub-batches (Mistral has limits)
  console.log(`🔮 Generating embeddings for ${batch.length} CVEs...`);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < batch.length; i += EMBEDDING_BATCH_SIZE) {
    const subBatch = batch.slice(i, Math.min(i + EMBEDDING_BATCH_SIZE, batch.length));
    const texts = subBatch.map(formatCVEForEmbedding);
    const embeddings = await generateBatchEmbeddings(texts);
    allEmbeddings.push(...embeddings);

    console.log(`   Generated embeddings ${i + 1}-${Math.min(i + EMBEDDING_BATCH_SIZE, batch.length)} of ${batch.length}`);
  }

  // Insert/update CVEs with embeddings
  console.log(`💾 Inserting/updating CVEs in database...`);

  for (let i = 0; i < batch.length; i++) {
    const cve = batch[i];
    const embedding = allEmbeddings[i];

    try {
      stats.total++;

      const action = await upsertCVE(client, cve, embedding);

      if (action === 'inserted') {
        stats.inserted++;
        console.log(`   ✅ Inserted ${cve.cve_id} (${cve.severity}, CVSS: ${cve.cvss_score})`);
      } else {
        stats.updated++;
        console.log(`   🔄 Updated ${cve.cve_id} (${cve.severity}, CVSS: ${cve.cvss_score})`);
      }

      // Insert CWE mappings
      if (cve.cwe_ids.length > 0) {
        const mappingsInserted = await insertCWEMappings(client, cve.cve_id, cve.cwe_ids);
        stats.cweMappings += mappingsInserted;

        // Update CWE database with related CVE
        for (const cweId of cve.cwe_ids) {
          await updateCWERelatedCVEs(client, cweId, cve.cve_id);
        }
      }

    } catch (error) {
      stats.errors++;
      console.error(`   ❌ Error processing ${cve.cve_id}:`, error);
    }
  }

  console.log(`✅ Batch complete: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.errors} errors`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let inputFile = DEFAULT_INPUT_FILE;
  let incremental = false;
  let batchSize = BATCH_SIZE;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputFile = args[i + 1];
      i++;
    } else if (args[i] === '--incremental') {
      incremental = true;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help') {
      console.log(`
NIST NVD CVE Ingestion Script

Usage:
  pnpm tsx scripts/ingest-nist-nvd.ts [options]

Options:
  --input <file>        Input JSONL file path (default: data/raw/nvd_cves.jsonl)
  --incremental         Incremental mode (upsert all records, don't skip existing)
  --batch-size <num>    Number of CVEs to process at once (default: 100)
  --help                Show this help message

Examples:
  # Initial full ingestion
  pnpm tsx scripts/ingest-nist-nvd.ts --batch-size 100

  # Incremental daily update
  pnpm tsx scripts/ingest-nist-nvd.ts --incremental --input data/raw/nvd_cves_incremental.jsonl

Environment Variables:
  DATABASE_URL          PostgreSQL connection string (required)
  MISTRAL_API_KEY       Mistral API key for embeddings (required)
      `);
      process.exit(0);
    }
  }

  // Validate environment
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!MISTRAL_API_KEY) {
    console.error('❌ MISTRAL_API_KEY environment variable is required');
    process.exit(1);
  }

  // Check input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    console.error('\n💡 Run the Python preprocessing script first:');
    console.error('   python data/ingest_nist_nvd.py --start-year 2020');
    process.exit(1);
  }

  try {
    const stats = await ingestCVEs(inputFile, incremental, batchSize);

    const duration = stats.endTime && stats.startTime
      ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 NIST NVD CVE Ingestion Summary');
    console.log('='.repeat(60));
    console.log(`✅ Total CVEs processed: ${stats.total}`);
    console.log(`   • Inserted: ${stats.inserted}`);
    console.log(`   • Updated: ${stats.updated}`);
    console.log(`   • Skipped: ${stats.skipped}`);
    console.log(`   • Errors: ${stats.errors}`);
    console.log(`\n🔗 CWE-CVE Mappings: ${stats.cweMappings}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`⚡ Rate: ${(stats.total / duration).toFixed(2)} CVEs/second`);
    console.log('='.repeat(60) + '\n');

    if (stats.errors > 0) {
      console.warn(`⚠️  Warning: ${stats.errors} errors occurred during ingestion`);
    }

    process.exit(stats.errors > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Fatal error during ingestion:', error);
    process.exit(1);
  }
}

main();
