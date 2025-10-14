/**
 * Test script for quick-coverage-enrichment-tool
 * 
 * This script tests the quick enrichment functionality with a small dataset.
 */

import 'dotenv/config';
import { quickCoverageEnrichmentTool } from '../src/mastra/tools/quick-coverage-enrichment-tool';

async function main() {
  console.log('\n⚡ Testing Quick Coverage Enrichment Tool');
  console.log('='.repeat(80));
  console.log('   This will fetch ~100-200 advisories (should take ~15-30 seconds)');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  try {
    const result = await quickCoverageEnrichmentTool.execute({
      context: {
        ecosystem: 'npm',
        severity: 'critical',
      },
    });

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Quick Enrichment Test Complete');
    console.log('='.repeat(80));
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Advisories Processed: ${result.stats.advisoriesProcessed}`);
    console.log(`   Code Examples Inserted: ${result.stats.codeExamplesInserted}`);
    console.log(`   Execution Time: ${elapsedTime}s (reported: ${result.stats.executionTimeSeconds}s)`);
    console.log('='.repeat(80) + '\n');

    // Validate it completed within target time
    if (elapsedTime <= 30) {
      console.log('✅ PASS: Completed within 30 second target');
    } else {
      console.log('⚠️  WARN: Exceeded 30 second target');
    }

  } catch (error) {
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    
    console.error('\n' + '='.repeat(80));
    console.error('❌ Quick Enrichment Test Failed');
    console.error('='.repeat(80));
    console.error(`   Error: ${error}`);
    console.error(`   Elapsed Time: ${elapsedTime}s`);
    console.error('='.repeat(80) + '\n');
    
    process.exit(1);
  }
}

main();

