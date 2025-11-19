/**
 * Test Retrieval Pipeline
 * 
 * This script tests the preprocessing and retrieval utilities
 * using the sample scan results.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { 
  preprocessScan, 
  generateLLMContext,
  generateScanEmbeddingText,
  type RawScanResult 
} from '../src/mastra/lib/scan-processor';
import {
  retrieveAndRerankContext,
  formatCompleteContext,
  closePgClient,
  type RetrievalConfig
} from '../src/mastra/lib/retrieval';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Main Test Function
// ============================================================================

async function testRetrievalPipeline() {
  console.log('🧪 Testing Venti AI Retrieval Pipeline\n');

  // Validate environment
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY environment variable is required');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Load sample scan
  const scanPath = join(__dirname, '..', 'docs', 'response_1758495835292 (1).json');
  console.log(`📖 Loading scan from: ${scanPath}`);
  
  const scanData: RawScanResult = JSON.parse(readFileSync(scanPath, 'utf-8'));
  console.log(`✅ Loaded scan with ${scanData.total} findings\n`);

  // ========================================
  // Step 1: Preprocess Scan
  // ========================================
  console.log('📊 Step 1: Preprocessing scan...');
  const processed = preprocessScan(scanData);

  console.log(`\n✅ Preprocessing complete:`);
  console.log(`   - Total findings: ${processed.summary.totalFindings}`);
  console.log(`   - Unique rules: ${processed.summary.uniqueRules.length}`);
  console.log(`   - Severity breakdown:`, processed.summary.severityBreakdown);
  console.log(`   - Risk score: ${processed.summary.riskScore}/100`);
  console.log(`   - Affected endpoints: ${processed.summary.affectedEndpoints}`);

  console.log(`\n📋 Top 3 prioritized findings:`);
  processed.prioritizedFindings.slice(0, 3).forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.title} (${f.severity}, score: ${f.maxScore})`);
    console.log(`      → OWASP: ${f.owasp_id}, Primary CWE: ${f.primary_cwes.join(', ')}`);
    console.log(`      → Affected: ${f.count}× across ${f.endpoints.length} endpoints`);
  });

  // ========================================
  // Step 2: Generate Contexts
  // ========================================
  console.log('\n\n📝 Step 2: Generating contexts...');
  
  const llmContext = generateLLMContext(processed);
  console.log(`\n✅ Generated LLM context (${llmContext.length} chars)`);
  console.log('Preview (first 500 chars):');
  console.log(llmContext.substring(0, 500) + '...\n');

  const embeddingText = generateScanEmbeddingText(processed);
  console.log(`✅ Generated embedding text (${embeddingText.length} chars)`);
  console.log('Preview (first 300 chars):');
  console.log(embeddingText.substring(0, 300) + '...\n');

  // ========================================
  // Step 3: Retrieve & Re-rank Context
  // ========================================
  console.log('\n🔍 Step 3: Retrieving and re-ranking context from database...\n');

  const config: RetrievalConfig = {
    connectionString: process.env.DATABASE_URL,
    mistralApiKey: process.env.MISTRAL_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  };

  try {
    const { owasp, cwe } = await retrieveAndRerankContext(processed, config, {
      owaspTopK: 5,
      cweTopK: 10,
    });

    console.log(`\n✅ Retrieval complete:`);
    console.log(`   - OWASP entries: ${owasp.length}`);
    console.log(`   - CWE entries: ${cwe.length}`);

    console.log(`\n📊 Top OWASP results:`);
    owasp.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.metadata.owasp_id}: ${r.metadata.category}`);
      console.log(`      Relevance: ${(r.score * 100).toFixed(1)}%`);
      console.log(`      Related CWEs: ${r.metadata.related_cwes?.slice(0, 3).join(', ') || 'None'}...`);
    });

    console.log(`\n📊 Top CWE results:`);
    cwe.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.metadata.cwe_id}: ${r.metadata.name}`);
      console.log(`      Relevance: ${(r.score * 100).toFixed(1)}%`);
    });

    // ========================================
    // Step 4: Format Complete Context
    // ========================================
    console.log('\n\n📄 Step 4: Formatting complete context for LLM...');
    
    const completeContext = formatCompleteContext(owasp, cwe);
    console.log(`✅ Generated complete context (${completeContext.length} chars)`);
    console.log('\nPreview (first 1000 chars):');
    console.log(completeContext.substring(0, 1000) + '...\n');

    // ========================================
    // Step 5: Token Efficiency Analysis
    // ========================================
    console.log('\n📈 Step 5: Token efficiency analysis...');
    
    const rawTokenEstimate = JSON.stringify(scanData).length / 4; // Rough estimate
    const processedTokenEstimate = llmContext.length / 4;
    const contextTokenEstimate = completeContext.length / 4;
    const totalTokens = processedTokenEstimate + contextTokenEstimate;

    console.log(`\n💰 Token usage estimates:`);
    console.log(`   - Raw scan JSON: ~${Math.round(rawTokenEstimate)} tokens`);
    console.log(`   - Processed scan summary: ~${Math.round(processedTokenEstimate)} tokens`);
    console.log(`   - Retrieved context: ~${Math.round(contextTokenEstimate)} tokens`);
    console.log(`   - Total for LLM: ~${Math.round(totalTokens)} tokens`);
    console.log(`   - Savings vs raw: ${Math.round((1 - totalTokens / (rawTokenEstimate * 6)) * 100)}%`);
    console.log(`     (Assuming 6× raw scans would be needed without deduplication)`);

    // ========================================
    // Summary
    // ========================================
    console.log('\n\n🎉 Pipeline test complete!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Preprocessing: Reduced ${processed.summary.totalFindings} findings to ${processed.summary.uniqueRules.length} unique rules`);
    console.log(`   ✅ Retrieval: Retrieved ${owasp.length + cwe.length} relevant security entries`);
    console.log(`   ✅ Re-ranking: Prioritized by scan-specific relevance`);
    console.log(`   ✅ Context: Generated ${Math.round(totalTokens)} tokens for LLM`);
    console.log(`\n🚀 Ready for agent implementation!`);

  } catch (error) {
    console.error('\n❌ Error during retrieval:', error);
    throw error;
  } finally {
    // Clean up database connection
    await closePgClient();
    console.log('\n🔌 Database connection closed');
  }
}

// ============================================================================
// Run Test
// ============================================================================

testRetrievalPipeline().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

