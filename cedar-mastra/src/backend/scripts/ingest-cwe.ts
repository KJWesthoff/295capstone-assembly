/**
 * Ingest CWE Top 25 data into PostgreSQL with embeddings
 * 
 * This script:
 * 1. Reads the cwe_top25.db.jsonl file
 * 2. Groups chunks by vulnerability_id
 * 3. Generates embeddings for each CWE entry
 * 4. Inserts into the cwe_database table
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import { mistral } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import 'dotenv/config'; // Load environment variables

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CWERecord {
  content: string;
  source: string;
  vulnerability_id: string;
  title: string;
  url: string;
  order_index: number;
}

interface CWEGrouped {
  cwe_id: string;
  title: string;
  url: string;
  chunks: CWERecord[];
}

interface CWEEntry {
  cwe_id: string;
  name: string;
  description: string;
  extended_description: string;
  consequences: string;
  mitigations: string;
  detection_methods: string;
  examples: string[];
  url: string;
}

/**
 * Load and parse the CWE JSONL file
 */
function loadCWEData(filePath: string): CWERecord[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.map(line => JSON.parse(line));
}

/**
 * Group CWE records by vulnerability_id since each CWE has multiple chunks
 */
function groupCWERecords(records: CWERecord[]): Map<string, CWEGrouped> {
  const grouped = new Map<string, CWEGrouped>();
  
  for (const record of records) {
    const key = record.vulnerability_id;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        cwe_id: `CWE-${record.vulnerability_id}`,
        title: record.title,
        url: record.url,
        chunks: []
      });
    }
    
    grouped.get(key)!.chunks.push(record);
  }
  
  return grouped;
}

/**
 * Parse CWE content chunks into structured fields
 */
function parseCWEEntry(group: CWEGrouped): CWEEntry {
  // Sort chunks by order_index to process in correct order
  const sortedChunks = [...group.chunks].sort((a, b) => a.order_index - b.order_index);
  
  let description = '';
  let extended_description = '';
  let consequences = '';
  let mitigations = '';
  let detection_methods = '';
  const examples: string[] = [];
  
  for (const chunk of sortedChunks) {
    const content = chunk.content;
    
    // First chunk is usually the main description
    if (chunk.order_index === 0 && content.includes('Description:')) {
      description = content.replace(/^.*Description:\s*/i, '').trim();
    }
    // Extended description (multiple chunks)
    else if (content.toLowerCase().includes('validation') || 
             content.toLowerCase().includes('structured data') ||
             (chunk.order_index === 1 && !content.includes('Consequences'))) {
      extended_description += content + '\n\n';
    }
    // Consequences
    else if (content.includes('Consequences of')) {
      consequences = content;
    }
    // Mitigations
    else if (content.includes('Mitigations for')) {
      mitigations += content + '\n\n';
    }
    // Detection methods
    else if (content.includes('Detection Methods for')) {
      detection_methods = content;
    }
    // Examples
    else if (content.includes('Example') && content.includes('for CWE-')) {
      examples.push(content);
    }
  }
  
  return {
    cwe_id: group.cwe_id,
    name: group.title.replace(/^CWE-\d+:\s*/, ''),
    description: description.trim(),
    extended_description: extended_description.trim(),
    consequences: consequences.trim(),
    mitigations: mitigations.trim(),
    detection_methods: detection_methods.trim(),
    examples,
    url: group.url
  };
}

/**
 * Generate embedding text for a CWE entry
 */
function generateEmbeddingText(entry: CWEEntry): string {
  return `
${entry.cwe_id}: ${entry.name}

Description:
${entry.description}

${entry.extended_description ? `Extended Description:\n${entry.extended_description.substring(0, 1000)}` : ''}

Consequences:
${entry.consequences.substring(0, 500)}

Mitigations:
${entry.mitigations.substring(0, 1000)}

Detection:
${entry.detection_methods.substring(0, 500)}
`.trim();
}

/**
 * Generate embeddings for CWE entries in batches
 */
async function generateEmbeddings(entries: CWEEntry[]): Promise<number[][]> {
  console.log(`\n🤖 Generating embeddings for ${entries.length} CWE entries using Mistral...`);
  
  const texts = entries.map(generateEmbeddingText);
  
  // Process in batches of 100
  const batchSize = 100;
  const allEmbeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}...`);
    
    const { embeddings } = await embedMany({
      model: mistral.embedding('mistral-embed'),
      values: batch,
    });
    
    allEmbeddings.push(...embeddings);
  }
  
  console.log(`✅ Generated ${allEmbeddings.length} embeddings (${allEmbeddings[0]?.length || 1024} dimensions each)`);
  return allEmbeddings;
}

/**
 * Insert CWE entries into PostgreSQL
 */
async function insertCWEEntries(
  client: Client,
  entries: CWEEntry[],
  embeddings: number[][]
): Promise<void> {
  console.log(`\n📥 Inserting ${entries.length} CWE entries into database...`);
  
  const insertQuery = `
    INSERT INTO cwe_database (
      cwe_id,
      name,
      description,
      extended_description,
      consequences,
      mitigations,
      detection_methods,
      examples,
      url,
      vector_embedding
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (cwe_id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      extended_description = EXCLUDED.extended_description,
      consequences = EXCLUDED.consequences,
      mitigations = EXCLUDED.mitigations,
      detection_methods = EXCLUDED.detection_methods,
      examples = EXCLUDED.examples,
      url = EXCLUDED.url,
      vector_embedding = EXCLUDED.vector_embedding,
      updated_at = NOW()
  `;
  
  let inserted = 0;
  let updated = 0;
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const embedding = embeddings[i];
    
    try {
      const result = await client.query(insertQuery, [
        entry.cwe_id,
        entry.name,
        entry.description,
        entry.extended_description,
        entry.consequences,
        entry.mitigations,
        entry.detection_methods,
        entry.examples,
        entry.url,
        `[${embedding.join(',')}]`, // Convert array to vector format
      ]);
      
      if (result.rowCount === 1) {
        inserted++;
      } else {
        updated++;
      }
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Processed ${i + 1}/${entries.length} entries...`);
      }
    } catch (error) {
      console.error(`❌ Error inserting ${entry.cwe_id}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Inserted ${inserted} new entries, updated ${updated} existing entries`);
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 Starting CWE Top 25 ingestion...\n');
  
  // Validate environment
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY environment variable is required');
  }
  
  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Load CWE data
    const dataPath = join(__dirname, '..', 'data', 'cwe_top25.db.jsonl');
    console.log(`📖 Loading CWE data from ${dataPath}...`);
    const records = loadCWEData(dataPath);
    console.log(`✅ Loaded ${records.length} chunks\n`);
    
    // Group by CWE ID
    console.log('🔗 Grouping chunks by CWE ID...');
    const grouped = groupCWERecords(records);
    console.log(`✅ Grouped into ${grouped.size} CWE entries\n`);
    
    // Parse into structured entries
    console.log('📝 Parsing CWE entries...');
    const entries = Array.from(grouped.values()).map(parseCWEEntry);
    console.log(`✅ Parsed ${entries.length} entries\n`);
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(entries);
    
    // Insert into database
    await insertCWEEntries(client, entries, embeddings);
    
    console.log('\n🎉 CWE ingestion complete!');
    console.log('\n📊 Summary:');
    console.log(`   Total CWE entries: ${entries.length}`);
    console.log(`   Total embeddings: ${embeddings.length}`);
    console.log(`   Embedding dimensions: ${embeddings[0]?.length || 0}`);
    
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

export { main as ingestCWE };

// Run if called directly (ES module compatible)
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

