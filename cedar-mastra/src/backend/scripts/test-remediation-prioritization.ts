/**
 * Test Remediation Prioritization Tool
 *
 * Demonstrates how the tool analyzes vulnerabilities and suggests fix order
 */

import 'dotenv/config';
import { remediationPrioritizationTool } from '../src/mastra/tools/remediation-prioritization-tool';

async function testRemediationPrioritization() {
  console.log('\n🎯 Testing Remediation Prioritization Tool\n');
  console.log('='.repeat(80));

  // Sample vulnerabilities from a typical scan
  const vulnerabilities = [
    {
      id: 'VULN-001',
      cveId: 'CVE-2024-12345',
      cweId: 'CWE-89',
      title: 'SQL Injection in user search endpoint',
      severity: 'CRITICAL' as const,
      cvssScore: 9.8,
      affectedEndpoints: ['/api/users/search', '/api/admin/users'],
      isPublicFacing: true,
    },
    {
      id: 'VULN-002',
      cweId: 'CWE-79',
      title: 'Cross-Site Scripting (XSS) in comment section',
      severity: 'HIGH' as const,
      cvssScore: 7.5,
      affectedEndpoints: ['/comments', '/api/comments/create'],
      isPublicFacing: true,
    },
    {
      id: 'VULN-003',
      cweId: 'CWE-200',
      title: 'Information disclosure in error messages',
      severity: 'MEDIUM' as const,
      cvssScore: 5.3,
      affectedEndpoints: ['/api/internal/debug'],
      isPublicFacing: false,
    },
    {
      id: 'VULN-004',
      cweId: 'CWE-352',
      title: 'CSRF vulnerability in profile update',
      severity: 'HIGH' as const,
      cvssScore: 6.5,
      affectedEndpoints: ['/api/profile/update'],
      isPublicFacing: true,
    },
    {
      id: 'VULN-005',
      cweId: 'CWE-502',
      title: 'Insecure deserialization in API',
      severity: 'CRITICAL' as const,
      cvssScore: 9.0,
      affectedEndpoints: ['/api/import/data'],
      isPublicFacing: true,
    },
    {
      id: 'VULN-006',
      cweId: 'CWE-22',
      title: 'Path traversal in file download',
      severity: 'HIGH' as const,
      cvssScore: 7.8,
      affectedEndpoints: ['/downloads', '/api/files/get'],
      isPublicFacing: true,
    },
    {
      id: 'VULN-007',
      cweId: 'CWE-287',
      title: 'Weak authentication mechanism',
      severity: 'MEDIUM' as const,
      cvssScore: 6.0,
      affectedEndpoints: ['/api/auth/legacy'],
      isPublicFacing: false,
    },
  ];

  try {
    console.log(`\n📊 Analyzing ${vulnerabilities.length} vulnerabilities...\n`);

    const result = await remediationPrioritizationTool.execute({
      context: { vulnerabilities },
      mastra: null as any,
    });

    // Display summary
    console.log('\n📈 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Vulnerabilities: ${result.summary.totalVulnerabilities}`);
    console.log(`Average Priority Score: ${result.summary.averagePriorityScore}/100`);
    console.log('');
    console.log('Priority Distribution:');
    console.log(`  🔴 P0 (Critical):  ${result.summary.p0Count} vulnerabilities`);
    console.log(`  🟠 P1 (High):      ${result.summary.p1Count} vulnerabilities`);
    console.log(`  🟡 P2 (Medium):    ${result.summary.p2Count} vulnerabilities`);
    console.log(`  🟢 P3 (Low):       ${result.summary.p3Count} vulnerabilities`);

    // Display prioritized list
    console.log('\n\n🎯 PRIORITIZED REMEDIATION PLAN');
    console.log('='.repeat(80));

    result.prioritizedList.forEach((item) => {
      const priorityEmoji = {
        P0: '🔴',
        P1: '🟠',
        P2: '🟡',
        P3: '🟢',
      }[item.priority];

      console.log(`\n${priorityEmoji} #${item.fixOrder}: ${item.title}`);
      console.log('─'.repeat(80));
      console.log(`Priority: ${item.priority} | Score: ${item.priorityScore}/100 | Deadline: ${item.recommendedDeadline}`);
      console.log(`ID: ${item.id}`);
      console.log('');
      console.log(`Reasoning: ${item.reasoning}`);
      console.log('');
      console.log('Factor Breakdown:');
      console.log(`  • Severity:          ${item.factors.severityScore}/100`);
      console.log(`  • Exploitability:    ${item.factors.exploitabilityScore}/100`);
      console.log(`  • Asset Criticality: ${item.factors.assetCriticalityScore}/100`);
      console.log(`  • Attack Surface:    ${item.factors.attackSurfaceScore}/100`);
      console.log(`  • Fix Availability:  ${item.factors.fixAvailabilityScore}/100`);
      console.log('');
      console.log('Recommendations:');
      item.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    });

    console.log('\n\n✅ Prioritization Complete!');
    console.log('='.repeat(80));
    console.log('\nNext Steps:');
    console.log('1. Start with P0 vulnerabilities immediately');
    console.log('2. Assign resources to P1 vulnerabilities within 7 days');
    console.log('3. Schedule P2 vulnerabilities for next sprint');
    console.log('4. Plan P3 vulnerabilities for next quarter\n');

  } catch (error) {
    console.error('\n❌ Error testing remediation prioritization:', error);
    process.exit(1);
  }
}

// Run test
testRemediationPrioritization();
