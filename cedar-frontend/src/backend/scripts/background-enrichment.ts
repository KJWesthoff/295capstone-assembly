/**
 * Background Enrichment Script
 * 
 * Runs comprehensive database enrichment in the background.
 * Can be triggered by cron job, admin command, or after-hours.
 * 
 * Usage:
 *   npx tsx scripts/background-enrichment.ts --ecosystem npm --max-time 15
 *   npx tsx scripts/background-enrichment.ts --all-ecosystems --max-time 60
 */

import 'dotenv/config';
import { ingestGitHubAdvisories } from './ingest-github-advisories';

interface EnrichmentConfig {
  ecosystem?: string;
  severity?: string;
  maxTimeMinutes: number;
  maxPages?: number;
}

const VALID_ECOSYSTEMS = [
  'npm', 'pip', 'maven', 'nuget', 'go', 'rubygems', 
  'rust', 'composer', 'erlang', 'actions', 'pub', 'swift', 'other'
];

async function runBackgroundEnrichment(config: EnrichmentConfig) {
  const { ecosystem, severity = 'critical', maxTimeMinutes, maxPages } = config;
  
  console.log('\n🌙 Background Enrichment Started');
  console.log('='.repeat(80));
  console.log(`   Max Time: ${maxTimeMinutes} minutes`);
  console.log(`   Ecosystem: ${ecosystem || 'all'}`);
  console.log(`   Severity: ${severity}`);
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  const startTime = Date.now();
  const maxTimeMs = maxTimeMinutes * 60 * 1000;

  try {
    // Calculate safe max pages based on time limit
    // Rough estimate: 1 page = ~30 seconds
    const estimatedMaxPages = maxPages || Math.floor(maxTimeMinutes * 2);
    const safeMaxPages = Math.min(estimatedMaxPages, 50); // Hard cap at 50
    
    console.log(`   Calculated max pages: ${safeMaxPages} (~${safeMaxPages * 0.5} minutes estimated)`);

    await ingestGitHubAdvisories({
      ecosystem: ecosystem as any,
      severity: severity as any,
      maxPages: safeMaxPages,
    });

    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = (elapsedMs / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Background Enrichment Complete');
    console.log(`   Duration: ${elapsedMinutes} minutes`);
    console.log(`   Ended: ${new Date().toISOString()}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = (elapsedMs / 1000 / 60).toFixed(2);

    console.error('\n' + '='.repeat(80));
    console.error('❌ Background Enrichment Failed');
    console.error(`   Duration: ${elapsedMinutes} minutes`);
    console.error(`   Error: ${error}`);
    console.error('='.repeat(80) + '\n');

    throw error;
  }
}

async function runAllEcosystems(config: Omit<EnrichmentConfig, 'ecosystem'>) {
  console.log('\n🌍 Enriching All Ecosystems Sequentially');
  console.log('='.repeat(80));

  const timePerEcosystem = Math.floor(config.maxTimeMinutes / VALID_ECOSYSTEMS.length);
  console.log(`   Time budget per ecosystem: ${timePerEcosystem} minutes`);
  console.log(`   Total ecosystems: ${VALID_ECOSYSTEMS.length}`);
  console.log('='.repeat(80) + '\n');

  for (const ecosystem of VALID_ECOSYSTEMS) {
    console.log(`\n📦 Processing ecosystem: ${ecosystem}`);
    
    try {
      await runBackgroundEnrichment({
        ...config,
        ecosystem,
        maxTimeMinutes: timePerEcosystem,
      });
    } catch (error) {
      console.error(`   ⚠️  Failed to process ${ecosystem}, continuing with next...`);
    }
  }

  console.log('\n✅ All ecosystems processed\n');
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  let ecosystem: string | undefined;
  let severity = 'critical';
  let maxTimeMinutes = 15; // Default 15 minutes
  let maxPages: number | undefined;
  let allEcosystems = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--ecosystem':
        ecosystem = args[++i];
        if (!VALID_ECOSYSTEMS.includes(ecosystem)) {
          console.error(`❌ Invalid ecosystem: ${ecosystem}`);
          console.error(`   Valid: ${VALID_ECOSYSTEMS.join(', ')}`);
          process.exit(1);
        }
        break;
      case '--severity':
        severity = args[++i];
        break;
      case '--max-time':
        maxTimeMinutes = parseInt(args[++i]);
        break;
      case '--max-pages':
        maxPages = parseInt(args[++i]);
        break;
      case '--all-ecosystems':
        allEcosystems = true;
        break;
      case '--help':
        console.log(`
Background Enrichment Script

Usage:
  npx tsx scripts/background-enrichment.ts [options]

Options:
  --ecosystem <name>     Specific ecosystem to enrich (npm, pip, maven, etc.)
  --severity <level>     Severity filter (low, moderate, high, critical)
  --max-time <minutes>   Maximum time to run (default: 15)
  --max-pages <number>   Override calculated max pages
  --all-ecosystems       Enrich all ecosystems sequentially
  --help                 Show this help

Examples:
  # Enrich npm for 15 minutes
  npx tsx scripts/background-enrichment.ts --ecosystem npm --max-time 15

  # Enrich all ecosystems for 1 hour
  npx tsx scripts/background-enrichment.ts --all-ecosystems --max-time 60

  # Quick 5-minute enrichment for Python
  npx tsx scripts/background-enrichment.ts --ecosystem pip --max-time 5

Recommended Usage:
  - Run during off-hours (cron job at 2 AM)
  - Start with 15-30 minutes per ecosystem
  - Run --all-ecosystems once per week
  - Use --max-time to respect your schedule
        `);
        process.exit(0);
    }
  }

  if (allEcosystems) {
    await runAllEcosystems({ severity, maxTimeMinutes, maxPages });
  } else if (ecosystem) {
    await runBackgroundEnrichment({ ecosystem, severity, maxTimeMinutes, maxPages });
  } else {
    console.error('❌ Error: Must specify --ecosystem or --all-ecosystems');
    console.error('   Run with --help for usage information');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

