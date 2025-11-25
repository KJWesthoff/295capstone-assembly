/**
 * Test Security Analyst Agent
 * 
 * This script tests the security analyst agent with sample scan data
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { analyzeScan, generateMarkdownReport } from '../src/mastra/agents/security-analyst';
import type { RawScanResult } from '../src/mastra/lib/scan-processor';
import type { RetrievalConfig } from '../src/mastra/lib/retrieval';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Main Test Function
// ============================================================================

async function testSecurityAgent() {
  console.log('🔒 Testing Security Analyst Agent\n');
  console.log('=' .repeat(80));

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
  console.log(`\n📖 Loading scan from: ${scanPath}`);
  
  const scanData: RawScanResult = JSON.parse(readFileSync(scanPath, 'utf-8'));
  console.log(`✅ Loaded scan with ${scanData.total} findings\n`);
  console.log('=' .repeat(80));

  // Configure retrieval
  const config: RetrievalConfig = {
    connectionString: process.env.DATABASE_URL,
    mistralApiKey: process.env.MISTRAL_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  };

  try {
    // Analyze scan
    const startTime = Date.now();
    const analysis = await analyzeScan(scanData, config);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('=' .repeat(80));
    console.log(`\n✅ Analysis completed in ${duration}s\n`);

    // Display summary
    console.log('📊 ANALYSIS SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Overall Risk Level: ${analysis.overallRiskLevel.toUpperCase()}`);
    console.log(`\nPriority Breakdown:`);
    console.log(`  P0 (Critical): ${analysis.p0_critical.length} issues`);
    console.log(`  P1 (High):     ${analysis.p1_high.length} issues`);
    console.log(`  P2 (Medium):   ${analysis.p2_medium.length} issues`);
    console.log(`  P3 (Low):      ${analysis.p3_low?.length || 0} issues`);

    console.log(`\nScan Metadata:`);
    console.log(`  Total Findings: ${analysis.scanMetadata.totalFindings}`);
    console.log(`  Unique Types:   ${analysis.scanMetadata.uniqueVulnerabilityTypes}`);
    console.log(`  Endpoints:      ${analysis.scanMetadata.affectedEndpoints}`);

    // Display P0 issues if any
    if (analysis.p0_critical.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES (P0):`);
      console.log('=' .repeat(80));
      analysis.p0_critical.forEach((finding, i) => {
        console.log(`\n${i + 1}. ${finding.title}`);
        console.log(`   Severity: ${finding.severity} | Risk: ${finding.riskScore}/100 | Exploitability: ${finding.exploitability}`);
        console.log(`   OWASP: ${finding.owaspCategory}`);
        console.log(`   Affected: ${finding.affectedEndpoints.length} endpoint(s)`);
        console.log(`   Impact: ${finding.businessImpact.substring(0, 100)}...`);
      });
    }

    // Display immediate actions
    console.log(`\n\n🎯 IMMEDIATE ACTIONS:`);
    console.log('=' .repeat(80));
    analysis.immediateActions.forEach((action, i) => {
      console.log(`${i + 1}. ${action}`);
    });

    // Generate markdown report
    console.log(`\n\n📝 Generating markdown report...`);
    const markdown = generateMarkdownReport(analysis);
    const reportPath = join(__dirname, '..', 'reports', `security-analysis-${Date.now()}.md`);
    
    // Ensure reports directory exists
    const { mkdirSync, existsSync } = await import('fs');
    const reportsDir = join(__dirname, '..', 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    writeFileSync(reportPath, markdown);
    console.log(`✅ Report saved to: ${reportPath}`);

    // Save JSON analysis
    const jsonPath = join(__dirname, '..', 'reports', `security-analysis-${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
    console.log(`✅ JSON analysis saved to: ${jsonPath}`);

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 Security analysis complete!');
    console.log(`${'='.repeat(80)}\n`);

    // Display preview of markdown report
    console.log('📄 MARKDOWN REPORT PREVIEW (first 1500 chars):');
    console.log('=' .repeat(80));
    console.log(markdown.substring(0, 1500));
    console.log('...\n');
    console.log(`Full report available at: ${reportPath}\n`);

  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    throw error;
  }
}

// ============================================================================
// Run Test
// ============================================================================

testSecurityAgent().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

