/**
 * NIST NVD CVE Retrieval Test Script
 *
 * Tests CVE-aware retrieval functionality:
 * - Direct CVE lookup by ID
 * - Semantic CVE search
 * - CVE-to-CWE mapping
 * - Exploit and KEV detection
 * - Performance benchmarking
 */

import 'dotenv/config';
import {
  initializePgClient,
  closePgClient,
  retrieveCVEById,
  retrieveCVEsByIds,
  retrieveCVEsByCWE,
  searchCVEsBySimilarity,
  generateQueryEmbedding,
  extractCVEIds,
  retrieveCVEAwareContext,
} from '../src/mastra/lib/retrieval';
import { preprocessScan } from '../src/mastra/lib/scan-processor';

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_SCAN_WITH_CVES = {
  scan_id: 'test-scan-001',
  total: 3,
  findings: [
    {
      rule: 'sql_injection',
      title: 'SQL Injection vulnerability (CVE-2023-38646)',
      severity: 'Critical' as const,
      score: 9.8,
      endpoint: '/api/users',
      method: 'POST',
      description: 'SQL injection in user authentication. Related to CVE-2023-38646.',
      evidence: { query: 'SELECT * FROM users WHERE id = ?', cve: 'CVE-2023-38646' },
    },
    {
      rule: 'xss',
      title: 'Cross-Site Scripting (CVE-2024-12345)',
      severity: 'High' as const,
      score: 7.5,
      endpoint: '/api/comments',
      method: 'POST',
      description: 'Reflected XSS vulnerability. CVE-2024-12345 detected.',
      evidence: { param: 'comment', cve: 'CVE-2024-12345' },
    },
    {
      rule: 'broken_auth',
      title: 'Authentication Bypass',
      severity: 'High' as const,
      score: 8.1,
      endpoint: '/api/login',
      method: 'POST',
      description: 'Weak JWT secret allows authentication bypass.',
      evidence: {},
    },
  ],
};

const TEST_CVE_IDS = [
  'CVE-2023-38646', // Metabase SQL Injection
  'CVE-2021-44228', // Log4Shell
  'CVE-2023-22515', // Atlassian Confluence
];

// ============================================================================
// Test Functions
// ============================================================================

async function testCVEExtraction() {
  console.log('\n📋 Test 1: CVE ID Extraction\n');
  console.log('='.repeat(60));

  const processed = preprocessScan(SAMPLE_SCAN_WITH_CVES);
  const cveIds = extractCVEIds(processed);

  console.log(`✅ Extracted CVE IDs: ${cveIds.join(', ')}`);
  console.log(`   Total: ${cveIds.length} CVEs\n`);

  return cveIds;
}

async function testDirectCVELookup(client: any, cveId: string) {
  console.log(`\n🔍 Test 2: Direct CVE Lookup (${cveId})\n`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const cve = await retrieveCVEById(client, cveId);
  const duration = Date.now() - startTime;

  if (cve) {
    console.log(`✅ CVE Found in ${duration}ms:`);
    console.log(`   ID: ${cve.cve_id}`);
    console.log(`   Title: ${cve.title}`);
    console.log(`   Severity: ${cve.severity} (CVSS: ${cve.cvss_score})`);
    console.log(`   CVSS Vector: ${cve.cvss_vector}`);
    console.log(`   CWEs: ${cve.cwe_ids?.join(', ') || 'None'}`);
    console.log(`   Published: ${new Date(cve.published_date).toLocaleDateString()}`);
    console.log(`   Exploit Available: ${cve.exploit_available ? '⚠️  YES' : 'No'}`);
    console.log(`   CISA KEV: ${cve.is_kev ? '🔴 YES' : 'No'}`);

    if (cve.is_kev && cve.kev_due_date) {
      console.log(`   KEV Due Date: ${new Date(cve.kev_due_date).toLocaleDateString()}`);
    }

    console.log(`\n   Description:`);
    console.log(`   ${cve.description.slice(0, 200)}...`);
  } else {
    console.log(`❌ CVE not found in database`);
    console.log(`   → Run ingestion: python data/ingest_nist_nvd.py --start-year 2021`);
  }

  return cve;
}

async function testBatchCVERetrieval(client: any, cveIds: string[]) {
  console.log(`\n📦 Test 3: Batch CVE Retrieval (${cveIds.length} CVEs)\n`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const cves = await retrieveCVEsByIds(client, cveIds);
  const duration = Date.now() - startTime;

  console.log(`✅ Retrieved ${cves.length} CVEs in ${duration}ms`);
  console.log(`   Average: ${(duration / cves.length).toFixed(2)}ms per CVE\n`);

  cves.forEach((cve, i) => {
    const exploitBadge = cve.exploit_available ? '⚠️ ' : '';
    const kevBadge = cve.is_kev ? '🔴' : '';
    console.log(`   ${i + 1}. ${exploitBadge}${kevBadge} ${cve.cve_id} - ${cve.severity} (${cve.cvss_score})`);
    console.log(`      ${cve.title.slice(0, 60)}...`);
  });

  return cves;
}

async function testCVEsByCWE(client: any, cweId: string) {
  console.log(`\n🔗 Test 4: CVE-to-CWE Mapping (${cweId})\n`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const cves = await retrieveCVEsByCWE(client, cweId, {
    minCvssScore: 7.0,
    exploitAvailable: true,
    limit: 10,
  });
  const duration = Date.now() - startTime;

  console.log(`✅ Found ${cves.length} CVEs for ${cweId} in ${duration}ms`);
  console.log(`   Filters: CVSS ≥ 7.0, Exploits Available\n`);

  cves.forEach((cve, i) => {
    console.log(`   ${i + 1}. ${cve.cve_id} - ${cve.severity} (${cve.cvss_score})`);
    console.log(`      Published: ${new Date(cve.published_date).toLocaleDateString()}`);
  });

  if (cves.length === 0) {
    console.log(`   ℹ️  No CVEs found with these filters`);
  }

  return cves;
}

async function testSemanticCVESearch(client: any, query: string) {
  console.log(`\n🔮 Test 5: Semantic CVE Search\n`);
  console.log('='.repeat(60));
  console.log(`Query: "${query}"\n`);

  const startTime = Date.now();
  const embedding = await generateQueryEmbedding(query);
  const embeddingTime = Date.now() - startTime;

  const searchStart = Date.now();
  const results = await searchCVEsBySimilarity(client, embedding, {
    minCvssScore: 6.0,
    severities: ['CRITICAL', 'HIGH'],
    limit: 5,
  });
  const searchTime = Date.now() - searchStart;

  console.log(`✅ Found ${results.length} similar CVEs`);
  console.log(`   Embedding generation: ${embeddingTime}ms`);
  console.log(`   Vector search: ${searchTime}ms`);
  console.log(`   Total: ${embeddingTime + searchTime}ms\n`);

  results.forEach((result, i) => {
    const meta = result.metadata;
    const exploitBadge = meta.exploit_available ? '⚠️ ' : '';
    const kevBadge = meta.is_kev ? '🔴' : '';

    console.log(`   ${i + 1}. ${exploitBadge}${kevBadge} ${meta.cve_id} - ${meta.severity} (${meta.cvss_score})`);
    console.log(`      Similarity: ${(result.score * 100).toFixed(1)}%`);
    console.log(`      ${meta.title.slice(0, 60)}...`);
  });

  return results;
}

async function testCVEAwareContext() {
  console.log(`\n🎯 Test 6: Full CVE-Aware Context Retrieval\n`);
  console.log('='.repeat(60));

  const processed = preprocessScan(SAMPLE_SCAN_WITH_CVES);
  const config = {
    connectionString: process.env.DATABASE_URL!,
    mistralApiKey: process.env.MISTRAL_API_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
  };

  const startTime = Date.now();
  const context = await retrieveCVEAwareContext(processed, config, {
    owaspTopK: 3,
    cweTopK: 5,
    includeCVEDetails: true,
    includeCodeExamples: true,
  });
  const duration = Date.now() - startTime;

  console.log(`✅ Retrieved complete CVE-aware context in ${duration}ms:`);
  console.log(`   OWASP Entries: ${context.owaspData.length}`);
  console.log(`   CWE Entries: ${context.cweData.length}`);
  console.log(`   CVE Details: ${context.cveData.length}`);
  console.log(`   Code Examples: ${context.codeExamples.length}`);
  console.log(`   Has CVE Data: ${context.hasCVEData ? '✅' : '❌'}\n`);

  if (context.cveData.length > 0) {
    console.log(`   CVE Details:`);
    context.cveData.forEach((cve, i) => {
      const exploitBadge = cve.exploit_available ? '⚠️ ' : '';
      const kevBadge = cve.is_kev ? '🔴' : '';
      console.log(`     ${i + 1}. ${exploitBadge}${kevBadge} ${cve.cve_id} - ${cve.severity} (${cve.cvss_score})`);
    });
  }

  return context;
}

async function testDatabaseStats(client: any) {
  console.log(`\n📊 Test 7: Database Statistics\n`);
  console.log('='.repeat(60));

  try {
    // Total CVEs
    const totalResult = await client.query('SELECT COUNT(*) as count FROM vulnerabilities');
    const totalCVEs = parseInt(totalResult.rows[0].count);

    // Severity breakdown
    const severityResult = await client.query(`
      SELECT severity, COUNT(*) as count
      FROM vulnerabilities
      GROUP BY severity
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END
    `);

    // CVEs with exploits
    const exploitResult = await client.query('SELECT COUNT(*) as count FROM vulnerabilities WHERE exploit_available = true');
    const exploitCount = parseInt(exploitResult.rows[0].count);

    // CVEs in KEV
    const kevResult = await client.query('SELECT COUNT(*) as count FROM vulnerabilities WHERE is_kev = true');
    const kevCount = parseInt(kevResult.rows[0].count);

    // Recent CVEs (last 30 days)
    const recentResult = await client.query(`
      SELECT COUNT(*) as count
      FROM vulnerabilities
      WHERE published_date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const recentCount = parseInt(recentResult.rows[0].count);

    console.log(`✅ NIST NVD Database Statistics:\n`);
    console.log(`   Total CVEs: ${totalCVEs.toLocaleString()}\n`);

    console.log(`   Severity Distribution:`);
    severityResult.rows.forEach(row => {
      const percentage = ((parseInt(row.count) / totalCVEs) * 100).toFixed(1);
      console.log(`     ${row.severity}: ${parseInt(row.count).toLocaleString()} (${percentage}%)`);
    });

    console.log(`\n   Special Categories:`);
    console.log(`     ⚠️  With Public Exploits: ${exploitCount.toLocaleString()}`);
    console.log(`     🔴 CISA KEV Listed: ${kevCount.toLocaleString()}`);
    console.log(`     📅 Last 30 Days: ${recentCount.toLocaleString()}\n`);

    // Check if database is populated
    if (totalCVEs === 0) {
      console.log(`   ⚠️  WARNING: Database is empty!`);
      console.log(`   → Run: python data/ingest_nist_nvd.py --start-year 2023`);
    } else if (totalCVEs < 1000) {
      console.log(`   ℹ️  Note: Limited data (${totalCVEs} CVEs)`);
      console.log(`   → For full coverage: python data/ingest_nist_nvd.py --start-year 2000`);
    }
  } catch (error) {
    console.error(`❌ Error querying database:`, error);
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let testCveId = 'CVE-2023-38646';
  let testQuery = 'SQL injection in authentication';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cve' && args[i + 1]) {
      testCveId = args[i + 1];
      i++;
    } else if (args[i] === '--query' && args[i + 1]) {
      testQuery = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log(`
NIST NVD CVE Retrieval Test Script

Usage:
  pnpm tsx scripts/test-nist-nvd-retrieval.ts [options]

Options:
  --cve <id>        Test specific CVE ID (default: CVE-2023-38646)
  --query <text>    Semantic search query (default: "SQL injection in authentication")
  --help            Show this help message

Examples:
  pnpm tsx scripts/test-nist-nvd-retrieval.ts
  pnpm tsx scripts/test-nist-nvd-retrieval.ts --cve CVE-2021-44228
  pnpm tsx scripts/test-nist-nvd-retrieval.ts --query "remote code execution"

Environment Variables:
  DATABASE_URL      PostgreSQL connection string (required)
  MISTRAL_API_KEY   Mistral API key for embeddings (required)
      `);
      process.exit(0);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🔬 NIST NVD CVE Retrieval Test Suite');
  console.log('='.repeat(80));

  const client = await initializePgClient(process.env.DATABASE_URL!);

  try {
    // Test 7: Database stats (run first to check if populated)
    await testDatabaseStats(client);

    // Test 1: CVE extraction
    const extractedCVEs = await testCVEExtraction();

    // Test 2: Direct CVE lookup
    await testDirectCVELookup(client, testCveId);

    // Test 3: Batch CVE retrieval
    await testBatchCVERetrieval(client, TEST_CVE_IDS);

    // Test 4: CVE-to-CWE mapping
    await testCVEsByCWE(client, 'CWE-89'); // SQL Injection

    // Test 5: Semantic search
    await testSemanticCVESearch(client, testQuery);

    // Test 6: Full CVE-aware context
    await testCVEAwareContext();

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await closePgClient();
  }
}

main();
