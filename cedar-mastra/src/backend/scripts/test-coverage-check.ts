/**
 * Test Script for Database Coverage Check Tool
 * 
 * Demonstrates how the security analyst agent can check database coverage
 * before performing analysis or ingestion.
 */

import 'dotenv/config';
import { checkDatabaseCoverageTool } from '../src/mastra/tools/check-database-coverage-tool';

async function main() {
  console.log('\n🔍 Testing Database Coverage Check Tool');
  console.log('='.repeat(80));

  // Test Case 1: Check coverage for common web vulnerabilities
  console.log('\n📊 Test Case 1: Common Web Vulnerabilities');
  console.log('-'.repeat(80));

  const test1 = await checkDatabaseCoverageTool.execute({
    context: {
      cwes: ['CWE-89', 'CWE-79', 'CWE-22', 'CWE-78'],
      minCoveragePercent: 50,
      minExamplesPerCWE: 2,
    },
  });

  console.log('\n📈 Summary:');
  console.log(`   Total CWEs: ${test1.summary.totalCWEs}`);
  console.log(`   CWEs with examples: ${test1.summary.cwesWithExamples}`);
  console.log(`   Coverage: ${test1.summary.coveragePercent}%`);
  console.log(`   Avg examples per CWE: ${test1.summary.averageExamplesPerCWE}`);

  console.log('\n💡 Recommendation:');
  console.log(`   Needs enrichment: ${test1.recommendations.needsEnrichment ? '⚠️ YES' : '✅ NO'}`);
  console.log(`   Reason: ${test1.recommendations.reason}`);
  console.log(`   Action: ${test1.recommendations.suggestedAction}`);

  console.log('\n📋 Details:');
  console.log(`   CWEs with examples: ${test1.details.cwesWithExamples.join(', ') || 'None'}`);
  console.log(`   CWEs missing examples: ${test1.details.cwesMissingExamples.join(', ') || 'None'}`);

  if (test1.details.exampleBreakdown.length > 0) {
    console.log('\n📊 Breakdown by CWE:');
    test1.details.exampleBreakdown.forEach((breakdown) => {
      console.log(`   ${breakdown.cwe_id}: ${breakdown.example_count} examples`);
      console.log(`      Vulnerable: ${breakdown.has_vulnerable ? '✅' : '❌'}`);
      console.log(`      Fixed: ${breakdown.has_fixed ? '✅' : '❌'}`);
    });
  }

  // Test Case 2: Check with stricter thresholds
  console.log('\n\n📊 Test Case 2: Stricter Quality Thresholds');
  console.log('-'.repeat(80));

  const test2 = await checkDatabaseCoverageTool.execute({
    context: {
      cwes: ['CWE-89', 'CWE-79', 'CWE-22'],
      minCoveragePercent: 80, // Higher threshold
      minExamplesPerCWE: 5,   // More examples required
    },
  });

  console.log('\n📈 Summary:');
  console.log(`   Coverage: ${test2.summary.coveragePercent}%`);
  console.log(`   Avg examples per CWE: ${test2.summary.averageExamplesPerCWE}`);

  console.log('\n💡 Recommendation:');
  console.log(`   Needs enrichment: ${test2.recommendations.needsEnrichment ? '⚠️ YES' : '✅ NO'}`);
  console.log(`   Reason: ${test2.recommendations.reason}`);

  // Test Case 3: Check coverage for CWEs we definitely don't have
  console.log('\n\n📊 Test Case 3: Rare/Uncommon CWEs');
  console.log('-'.repeat(80));

  const test3 = await checkDatabaseCoverageTool.execute({
    context: {
      cwes: ['CWE-1234', 'CWE-5678', 'CWE-9999'],
    },
  });

  console.log('\n📈 Summary:');
  console.log(`   Coverage: ${test3.summary.coveragePercent}%`);
  console.log(`   CWEs missing: ${test3.details.cwesMissingExamples.join(', ')}`);

  console.log('\n💡 Recommendation:');
  console.log(`   ${test3.recommendations.suggestedAction}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Coverage check tests complete!\n');
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

