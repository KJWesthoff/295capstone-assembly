import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { openai } from '@ai-sdk/openai';
// ... (keep existing imports)

// ... (inside tools object)
import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import {
  preprocessScan,
  generateLLMContext,
  type RawScanResult,
  type ProcessedScan,
} from '../lib/scan-processor';
import {
  retrieveAndRerankContext,
  formatCompleteContext,
  closePgClient,
  type RetrievalConfig,
} from '../lib/retrieval';
import { analyzeScanTool } from '../tools/analyze-scan-tool';
import { getSecurityIntelligenceTool } from '../tools/get-security-intelligence';
import { remediationPrioritizationTool } from '../tools/remediation-prioritization-tool';
import { visualizeAttackPathTool } from '../tools/visualize-attack-path-tool';
import { scanAnalysisWorkflow } from '../workflows/scan-analysis-workflow';

// ============================================================================
// Output Schemas
// ============================================================================

const FindingAnalysisSchema = z.object({
  rule: z.string().describe('Vulnerability rule ID'),
  title: z.string().describe('Vulnerability title'),
  severity: z.string().describe('Severity level: Critical, High, Medium, or Low'),
  riskScore: z.number().min(0).max(100).describe('Calculated risk score (0-100)'),

  // Context
  owaspCategory: z.string().describe('OWASP category (e.g., A03:2021)'),
  relatedCWEs: z.array(z.string()).describe('Related CWE IDs with descriptions (e.g., CWE-89: SQL Injection)'),
  mitreAttack: z.string().optional().describe('MITRE ATT&CK technique ID and name (e.g., T1190: Exploit Public-Facing Application)'),
  affectedEndpoints: z.array(z.string()).describe('List of affected API endpoints'),

  // Impact
  businessImpact: z.string().describe('Potential business impact if exploited'),
  technicalImpact: z.string().describe('Technical consequences'),
  exploitability: z.string().describe('How easy to exploit: trivial, easy, moderate, or difficult'),
  whyThisIsCritical: z.array(z.string()).describe('3-5 bullet points explaining why this vulnerability is dangerous'),

  // Remediation
  remediationSteps: z.array(z.object({
    step: z.number(),
    action: z.string(),
    details: z.string(),
    priority: z.string().describe('immediate, high, medium, or low'),
  })).describe('Step-by-step fix instructions'),
  codeExamples: z.array(z.object({
    language: z.string(),
    vulnerable: z.string(),
    fixed: z.string(),
    explanation: z.string(),
  })).optional().describe('Code examples showing vulnerable → fixed versions'),
  estimatedEffort: z.string().describe('Time estimate to fix (e.g., "2-4 hours")'),

  // Additional Protections
  additionalMitigations: z.array(z.object({
    type: z.string().describe('Type of mitigation (e.g., "Input Validation", "WAF Rules")'),
    description: z.string().describe('How to implement this mitigation'),
  })).describe('Defense-in-depth measures beyond the primary fix'),

  // Detection & Prevention
  detectionMethods: z.array(z.string()).describe('How to detect this vulnerability'),
  preventionStrategies: z.array(z.string()).describe('How to prevent in the future'),

  // Real-World Context
  realWorldBreaches: z.array(z.object({
    company: z.string(),
    year: z.number(),
    impact: z.string().describe('What happened'),
    statistics: z.string().optional().describe('Numbers, costs, records affected'),
    keyLesson: z.string().describe('Key takeaway for developers'),
  })).optional().describe('Similar real-world security incidents'),

  // Verification
  verificationSteps: z.array(z.string()).describe('Steps to verify the fix works after implementation'),

  // References
  references: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).describe('Relevant documentation and resources'),
});

const SecurityAnalysisSchema = z.object({
  // Executive Summary
  executiveSummary: z.string().describe('High-level summary for non-technical stakeholders'),
  overallRiskLevel: z.string().describe('Overall risk assessment: critical, high, medium, or low'),

  // Prioritized Findings
  p0_critical: z.array(FindingAnalysisSchema).describe('P0: Critical issues requiring immediate action'),
  p1_high: z.array(FindingAnalysisSchema).describe('P1: High priority issues (fix within 7 days)'),
  p2_medium: z.array(FindingAnalysisSchema).describe('P2: Medium priority issues (fix within 30 days)'),
  p3_low: z.array(FindingAnalysisSchema).optional().describe('P3: Low priority issues (fix within 90 days)'),

  // Recommendations
  immediateActions: z.array(z.string()).describe('Actions to take right now'),
  shortTermActions: z.array(z.string()).describe('Actions for next 1-2 weeks'),
  longTermActions: z.array(z.string()).describe('Long-term security improvements'),

  // Metadata
  scanMetadata: z.object({
    totalFindings: z.number(),
    uniqueVulnerabilityTypes: z.number(),
    affectedEndpoints: z.number(),
    analysisTimestamp: z.string(),
  }),
});

export type SecurityAnalysis = z.infer<typeof SecurityAnalysisSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const securityAnalystAgent = new Agent({
  name: 'Security Analyst',
  description: 'Expert security analyst providing actionable vulnerability intelligence',

  instructions: `
You are Venti, a friendly and knowledgeable security assistant. You help business owners, analysts, and developers understand and address security issues.

## 🚨 CRITICAL: CHECK PAGE CONTEXT FIRST

Before responding, look for "[AUDIENCE:" in the user's message context. This tells you WHO you're talking to:

### If you see "[AUDIENCE: Small Business Owner / Executive]":
**STOP. DO NOT generate a formal security report.**

**CRITICAL: If you have scan data in the context, USE IT IMMEDIATELY!**
- Don't ask "what brought you here?" if they already told you
- Don't ask generic questions when you have specific findings
- Connect the scan findings to their stated problem right away

Instead:
1. **Lead with what you know** - If scan data shows issues, explain them in plain terms
2. **Connect findings to their problem** - "Your Google suspension is probably because..."
3. **Keep it SHORT** - 2-3 paragraphs MAX
4. **NO technical jargon** - No CVSS, CWE, OWASP, P0/P1, injection, etc.
5. **Offer to draft an email** - Help them communicate with their developer
6. **NEVER conclude** - Always offer more help

Example good response (when you have scan data):
"I can see what's going on from your scan results. Your site has a security issue where people can access pages they shouldn't be able to - that's almost certainly why Google flagged your Merchant Center.

The good news: this is a known issue and totally fixable. Your developer will know what to do once they see the details.

Want me to draft an email you can send them? I'll keep it non-technical but include everything they need to fix it."

### If you see "[AUDIENCE: Security Analyst / Technical Lead]":
- Use technical terminology (CVSS, CWE, OWASP)
- Focus on exploitability and prioritization
- Provide detailed analysis but stay conversational
- Help with validation and risk assessment

### If you see "[AUDIENCE: Developer / Engineer]":
- Lead with code examples (before/after)
- Be technically precise
- Explain root cause briefly
- Suggest tests to verify fixes

### If NO audience context or general user:
- Be friendly and helpful
- Ask what they need help with
- Guide them to the right information

## Core Behavior

**ALWAYS**:
- Respond in markdown format
- Be conversational, not lecture-y
- Ask questions before dumping information
- Keep responses focused (don't cover everything at once)
- End with an invitation to continue the conversation

**NEVER**:
- Generate formal "Security Analysis Report" documents for executives
- Use technical jargon with non-technical users
- Conclude conversations with "In conclusion..." or "To summarize..."
- Overwhelm users with comprehensive coverage
- Return raw JSON

## Tools Available

You have access to these tools - use them when helpful:

- **scan-analysis-workflow**: Analyzes vulnerability scans. Returns raw data you must interpret FOR YOUR AUDIENCE.
- **getSecurityIntelligenceTool**: Looks up CVEs, CWEs, code examples
- **remediationPrioritizationTool**: Helps prioritize what to fix first
- **visualizeAttackPathTool**: Creates visual diagrams (use for analysts/developers, NOT executives)

## When Using scan-analysis-workflow

After the workflow returns data:
1. **Check the audience context first**
2. **For executives**: Summarize in 2-3 plain-language sentences, then ask a follow-up question
3. **For analysts**: Provide structured analysis with technical details
4. **For developers**: Focus on code fixes and remediation steps

## Security Rules

- Never reveal internal URLs, credentials, or infrastructure details
- When errors occur, give user-friendly messages

## Remember

Your job is to make security feel manageable, not scary. Help people take action, not feel overwhelmed.
  `.trim(),
  model: openai('gpt-4o'),

  // Individual tools for specific queries
  tools: {
    scanAnalysisWorkflow: createTool({
      id: 'scanAnalysisWorkflow',
      description: 'Automated analysis of API vulnerability scans',
      inputSchema: z.object({
        scanId: z.string().describe('The UUID of the scan to analyze'),
      }),
      outputSchema: z.object({
        scanContext: z.string(),
        securityContext: z.string(),
        codeExamples: z.array(z.any()),
        metadata: z.object({
          totalFindings: z.number(),
          uniqueRules: z.number(),
          owaspEntriesRetrieved: z.number(),
          cweEntriesRetrieved: z.number(),
        }),
      }),
      execute: async ({ context }) => {
        console.log('🚀 ENTRY: scanAnalysisWorkflow wrapper called');
        console.log('Context:', JSON.stringify(context));
        try {
          console.log('Creating workflow run...');
          const run = await scanAnalysisWorkflow.createRunAsync();
          console.log('Starting workflow with scanId:', context.scanId);
          const result = await run.start({
            inputData: { scanId: context.scanId },
          });

          console.log('Workflow result status:', result.status);
          console.log('Workflow result keys:', Object.keys(result));

          if (result.status !== 'success') {
            console.error('Workflow failed with status:', result.status);
            console.error('Full result:', JSON.stringify(result, null, 2));
            throw new Error(`Workflow failed: ${result.status}`);
          }

          console.log('✅ Workflow execution completed via wrapper');
          console.log('Result keys:', Object.keys(result.result || {}));

          // Log what we're returning to the agent
          const returnData = result.result;
          console.log('📤 RETURNING TO AGENT:');
          console.log('  - scanContext length:', returnData?.scanContext?.length || 0);
          console.log('  - securityContext length:', returnData?.securityContext?.length || 0);
          console.log('  - codeExamples count:', returnData?.codeExamples?.length || 0);
          console.log('  - metadata:', JSON.stringify(returnData?.metadata));

          return returnData;
        } catch (error) {
          console.error('❌ ERROR in scanAnalysisWorkflow wrapper:', error);
          console.error('Error stack:', (error as Error).stack);
          throw error;
        }
      },
    }),
    getSecurityIntelligenceTool, // Unified retrieval tool
    remediationPrioritizationTool,
    visualizeAttackPathTool, // Generate visual attack flow diagrams
  },

  // Enable conversation memory for multi-turn interactions
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: (() => {
        const baseUrl = process.env.DATABASE_URL || 'postgresql://rag_user:rag_pass@postgres:5432/rag_db';
        // Disable SSL for Docker internal connections
        return baseUrl.includes('?') ? `${baseUrl}&sslmode=disable` : `${baseUrl}?sslmode=disable`;
      })(),
    }),
  }),
});

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyzes a vulnerability scan and generates comprehensive security report
 */
export async function analyzeScan(
  scan: RawScanResult,
  config: RetrievalConfig
): Promise<SecurityAnalysis> {
  try {
    console.log('\n🔒 Starting Security Analysis...\n');

    // Step 1: Preprocess scan
    console.log('📊 Preprocessing scan results...');
    const processed = preprocessScan(scan);
    console.log(`✅ Processed ${processed.summary.totalFindings} findings into ${processed.summary.uniqueRules.length} unique types\n`);

    // Step 2: Retrieve security intelligence (reduced for token limits)
    console.log('🔍 Retrieving security intelligence from database...');
    const { owaspData, cweData } = await retrieveAndRerankContext(processed, config, {
      owaspTopK: 2,  // Reduced for context size
      cweTopK: 3,    // Reduced for context size
    });
    console.log(`✅ Retrieved ${owaspData.length} OWASP entries and ${cweData.length} CWE entries\n`);

    // Step 3: Format context for LLM
    console.log('📄 Formatting context for analysis...');
    const scanContext = generateLLMContext(processed);
    const securityContext = formatCompleteContext(owaspData, cweData);
    console.log(`✅ Prepared ${Math.round((scanContext.length + securityContext.length) / 4)} tokens of context\n`);

    // Step 4: Generate analysis with agent
    console.log('🤖 Generating security analysis with AI agent...');
    const result = await securityAnalystAgent.generate(
      `
Analyze these API vulnerability scan results. Provide comprehensive, actionable security assessment using the provided intelligence.

# Scan Data

${scanContext}

# Security Intelligence

${securityContext}

# Requirements

1. Address EVERY finding with full detail per the structured schema
2. Use code examples from context (reference, don't copy)
3. Include breach data ONLY when provided
4. Prioritize by risk (P0/P1/P2/P3)
5. Provide actionable remediation steps
6. Be accurate - omit optional sections if data unavailable
      `.trim(),
      {
        output: SecurityAnalysisSchema,
      }
    );

    console.log('✅ Security analysis complete!\n');

    return result.object as SecurityAnalysis;

  } catch (error) {
    console.error('❌ Error during security analysis:', error);
    throw error;
  } finally {
    // Clean up database connection
    await closePgClient();
  }
}

/**
 * Generates a markdown report from the security analysis
 */
export function generateMarkdownReport(analysis: SecurityAnalysis): string {
  let report = `# Security Vulnerability Analysis Report

**Generated**: ${analysis.scanMetadata.analysisTimestamp}  
**Overall Risk Level**: ${analysis.overallRiskLevel.toUpperCase()}

---

## Executive Summary

${analysis.executiveSummary}

### Scan Overview
- **Total Findings**: ${analysis.scanMetadata.totalFindings}
- **Unique Vulnerability Types**: ${analysis.scanMetadata.uniqueVulnerabilityTypes}
- **Affected Endpoints**: ${analysis.scanMetadata.affectedEndpoints}

---

## Priority Breakdown

| Priority | Count | Action Required |
|----------|-------|-----------------|
| P0 (Critical) | ${analysis.p0_critical.length} | Immediate (< 24 hours) |
| P1 (High) | ${analysis.p1_high.length} | Within 7 days |
| P2 (Medium) | ${analysis.p2_medium.length} | Within 30 days |
| P3 (Low) | ${analysis.p3_low?.length || 0} | Within 90 days |

---

`;

  // P0 Critical Issues
  if (analysis.p0_critical.length > 0) {
    report += `## 🚨 P0: Critical Issues (IMMEDIATE ACTION REQUIRED)\n\n`;
    analysis.p0_critical.forEach((finding, i) => {
      report += formatFindingMarkdown(finding, i + 1);
    });
    report += `\n---\n\n`;
  }

  // P1 High Priority Issues
  if (analysis.p1_high.length > 0) {
    report += `## ⚠️ P1: High Priority Issues (Fix Within 7 Days)\n\n`;
    analysis.p1_high.forEach((finding, i) => {
      report += formatFindingMarkdown(finding, i + 1);
    });
    report += `\n---\n\n`;
  }

  // P2 Medium Priority Issues
  if (analysis.p2_medium.length > 0) {
    report += `## 📋 P2: Medium Priority Issues (Fix Within 30 Days)\n\n`;
    analysis.p2_medium.forEach((finding, i) => {
      report += formatFindingMarkdown(finding, i + 1);
    });
    report += `\n---\n\n`;
  }

  // P3 Low Priority Issues
  if (analysis.p3_low && analysis.p3_low.length > 0) {
    report += `## 📝 P3: Low Priority Issues (Fix Within 90 Days)\n\n`;
    analysis.p3_low.forEach((finding, i) => {
      report += formatFindingMarkdown(finding, i + 1);
    });
    report += `\n---\n\n`;
  }

  // Action Items
  report += `## 🎯 Action Items\n\n`;

  report += `### Immediate Actions (Today)\n\n`;
  analysis.immediateActions.forEach((action, i) => {
    report += `${i + 1}. ${action}\n`;
  });
  report += `\n`;

  report += `### Short-Term Actions (Next 1-2 Weeks)\n\n`;
  analysis.shortTermActions.forEach((action, i) => {
    report += `${i + 1}. ${action}\n`;
  });
  report += `\n`;

  report += `### Long-Term Actions (Next Quarter)\n\n`;
  analysis.longTermActions.forEach((action, i) => {
    report += `${i + 1}. ${action}\n`;
  });

  report += `\n---\n\n`;
  report += `*Report generated by Venti AI Security Analyst*\n`;

  return report;
}

/**
 * Formats a single finding for markdown output
 */
function formatFindingMarkdown(finding: z.infer<typeof FindingAnalysisSchema>, index: number): string {
  let md = `### ${index}. ${finding.title}\n\n`;

  // Severity Assessment Section
  md += `#### Severity Assessment\n`;
  md += `- **Severity**: ${finding.severity}\n`;
  md += `- **Risk Score**: ${finding.riskScore}/100\n`;
  md += `- **CWE**: ${finding.relatedCWEs.join(', ')}\n`;
  md += `- **OWASP**: ${finding.owaspCategory}\n`;
  if (finding.mitreAttack) {
    md += `- **MITRE ATT&CK**: ${finding.mitreAttack}\n`;
  }
  md += `- **Exploitability**: ${finding.exploitability}\n\n`;

  // Why This Is Critical Section
  if (finding.whyThisIsCritical && finding.whyThisIsCritical.length > 0) {
    md += `#### Why This Is Critical\n`;
    finding.whyThisIsCritical.forEach(point => {
      md += `- ${point}\n`;
    });
    md += `\n`;
  }

  // Priority with emoji
  const priorityEmoji = finding.severity === 'Critical' ? '🔴' :
    finding.severity === 'High' ? '🟡' :
      finding.severity === 'Medium' ? '🟠' : '🟢';
  const priorityLevel = finding.severity === 'Critical' ? 'IMMEDIATE (P0)' :
    finding.severity === 'High' ? 'HIGH (P1)' :
      finding.severity === 'Medium' ? 'MEDIUM (P2)' : 'LOW (P3)';
  const timeline = finding.severity === 'Critical' ? 'Fix within 24-48 hours' :
    finding.severity === 'High' ? 'Fix within 7 days' :
      finding.severity === 'Medium' ? 'Fix within 30 days' : 'Fix within 90 days';

  md += `#### Recommended Remediation Priority: ${priorityEmoji} ${priorityLevel}\n`;
  md += `**Timeline**: ${timeline} | **Estimated Effort**: ${finding.estimatedEffort}\n\n`;

  // Affected Endpoints
  md += `#### Affected Endpoints\n`;
  finding.affectedEndpoints.forEach(endpoint => {
    md += `- **\`${endpoint}\`**\n`;
  });
  md += `\n`;

  // Business Impact
  md += `#### Business Impact\n${finding.businessImpact}\n\n`;

  // Technical Impact
  md += `#### Technical Impact\n${finding.technicalImpact}\n\n`;

  // Remediation Steps
  md += `#### Remediation Steps\n\n`;
  finding.remediationSteps.forEach(step => {
    md += `${step.step}. **${step.action}** (${step.priority})\n`;
    md += `   ${step.details}\n\n`;
  });

  // Code Examples
  if (finding.codeExamples && finding.codeExamples.length > 0) {
    md += `#### Code Examples\n\n`;
    finding.codeExamples.forEach(example => {
      md += `**${example.language}**\n\n`;
      md += `**Vulnerable Code**:\n\`\`\`${example.language.toLowerCase()}\n${example.vulnerable}\n\`\`\`\n\n`;
      md += `**Fixed Code**:\n\`\`\`${example.language.toLowerCase()}\n${example.fixed}\n\`\`\`\n\n`;
      md += `*${example.explanation}*\n\n`;
    });
  }

  // Additional Mitigations
  if (finding.additionalMitigations && finding.additionalMitigations.length > 0) {
    md += `#### Additional Mitigations\n`;
    finding.additionalMitigations.forEach((mitigation, i) => {
      md += `${i + 1}. **${mitigation.type}**: ${mitigation.description}\n`;
    });
    md += `\n`;
  }

  // Real-World Breaches
  if (finding.realWorldBreaches && finding.realWorldBreaches.length > 0) {
    md += `#### Real-World Impact: Similar Breaches\n`;
    finding.realWorldBreaches.forEach(breach => {
      md += `**${breach.company} (${breach.year})**\n`;
      md += `- ${breach.impact}\n`;
      if (breach.statistics) {
        md += `- ${breach.statistics}\n`;
      }
      md += `- **Lesson**: ${breach.keyLesson}\n\n`;
    });
  }

  // Detection Methods
  md += `#### Detection Methods\n`;
  finding.detectionMethods.forEach(method => {
    md += `- ${method}\n`;
  });
  md += `\n`;

  // Prevention Strategies
  md += `#### Prevention Strategies\n`;
  finding.preventionStrategies.forEach(strategy => {
    md += `- ${strategy}\n`;
  });
  md += `\n`;

  // Verification Steps
  if (finding.verificationSteps && finding.verificationSteps.length > 0) {
    md += `#### Verification Steps\n`;
    md += `After fixing:\n`;
    finding.verificationSteps.forEach((step, i) => {
      md += `${i + 1}. ${step}\n`;
    });
    md += `\n`;
  }

  // References
  if (finding.references.length > 0) {
    md += `#### References\n`;
    finding.references.forEach(ref => {
      md += `- [${ref.title}](${ref.url})\n`;
    });
    md += `\n`;
  }

  return md;
}

