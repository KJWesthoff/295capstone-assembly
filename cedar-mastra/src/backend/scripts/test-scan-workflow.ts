/**
 * Test Script for Scan Analysis Workflow
 * 
 * Demonstrates the intelligent workflow that:
 * 1. Analyzes scan metadata
 * 2. Checks database for code example coverage
 * 3. Conditionally enriches database if needed
 * 4. Generates analysis with enriched data
 */

import 'dotenv/config';
import { mastra } from '../src/mastra';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n🚀 Starting Intelligent Scan Analysis Workflow');
  console.log('='.repeat(80));

  // Load sample scan data
  const scanPath = path.join(__dirname, '../docs/scan-response-object.json');
  const scanData = fs.readFileSync(scanPath, 'utf-8');

  // Get the workflow
  const workflow = mastra.getWorkflow('scanAnalysisWorkflow');
  
  if (!workflow) {
    console.error('❌ Workflow not found');
    return;
  }

  // Create a run instance
  const run = await workflow.createRunAsync();

  // Watch the workflow execution
  run.watch((event) => {
    const { payload } = event;
    
    if (payload.currentStep) {
      const step = payload.currentStep;
      console.log(`\n📍 Step: ${step.id}`);
      console.log(`   Status: ${step.payload?.status || 'running'}`);
      
      if (step.payload?.output) {
        console.log(`   Output keys: ${Object.keys(step.payload.output).join(', ')}`);
      }
    }
  });

  // Start the workflow
  console.log('\n▶️  Starting workflow execution...\n');
  
  const result = await run.start({
    inputData: {
      scanData,
    },
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Workflow Complete!');
  console.log('='.repeat(80));

  if (result.status === 'success') {
    const { metadata, enrichmentStats } = result.result;
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   Total Findings: ${metadata.totalFindings}`);
    console.log(`   Unique Rules: ${metadata.uniqueRules}`);
    console.log(`   OWASP Entries Retrieved: ${metadata.owaspEntriesRetrieved}`);
    console.log(`   CWE Entries Retrieved: ${metadata.cweEntriesRetrieved}`);
    
    console.log(`\n🔄 Enrichment Stats:`);
    console.log(`   Database Was Enriched: ${enrichmentStats.wasEnriched ? 'Yes ✅' : 'No (sufficient coverage)'}`);
    console.log(`   New Examples Added: ${enrichmentStats.newExamples}`);
    
    console.log(`\n📝 Context Summary:`);
    console.log(`   Scan Context Length: ${result.result.scanContext.length} chars`);
    console.log(`   Security Context Length: ${result.result.securityContext.length} chars`);
    
  } else if (result.status === 'failed') {
    console.error(`\n❌ Workflow failed: ${result.error}`);
    console.error('\nStep Details:');
    Object.entries(result.steps).forEach(([stepId, stepData]: [string, any]) => {
      if (stepData.status === 'failed') {
        console.error(`   ${stepId}: ${stepData.error}`);
      }
    });
  } else if (result.status === 'suspended') {
    console.log(`\n⏸️  Workflow suspended at: ${result.suspended.join(' → ')}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

