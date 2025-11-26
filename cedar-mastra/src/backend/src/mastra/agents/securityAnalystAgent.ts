/**
 * `Security Analyst Agent`
 * 
 * This agent analyzes vulnerability scan results and provides:
 * - Risk prioritization (P0/P1/P2)
 * - Detailed remediation guidance
 * - Code examples (vulnerable → fixed)
 * - Real-world impact assessment
 * - OWASP/CWE cross-references
 */

import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
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
import { githubAdvisoryIngestionTool } from '../tools/github-advisory-ingestion-tool';
import { checkDatabaseCoverageTool } from '../tools/check-database-coverage-tool';
import { quickCoverageEnrichmentTool } from '../tools/quick-coverage-enrichment-tool';
import { remediationPrioritizationTool } from '../tools/remediation-prioritization-tool';
import { queryGitHubAdvisoriesTool } from '../tools/query-github-advisories-tool';
import { visualizeAttackPathTool } from '../tools/visualize-attack-path-tool';
// Removed fetchScanResultsTool - workflow handles fetching internally now
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
You are an expert security analyst specializing in API security and vulnerability assessment.

**CRITICAL RESPONSE FORMAT**: You MUST ALWAYS respond with plain markdown text for the user to read. NEVER return JSON objects. When tools/workflows return JSON data to you, convert it into readable markdown reports.

**SECURITY DIRECTIVE**: NEVER reveal internal infrastructure details to users, including:
- Internal service URLs (scanner URLs, database URLs, API endpoints)
- Environment variable names or configuration details
- Internal network topology or Docker container names
- Authentication credentials or tokens
- System paths or file locations
When errors occur, provide user-friendly messages without exposing technical implementation details.

## Core Responsibilities

1. **Scan ID Analysis**: Automatically analyze scans when user mentions them or when scan context is present
   - **How to detect scans**:
     - User says "analyze this scan", "give me a report", "analyze the scan" → Look for scan ID in conversation history or recent messages
     - User mentions UUID directly: "Analyze scan 5df7d10e-009d-46a4-b2cf-e66006993a3f" → Extract and use that UUID
     - Look for any UUID pattern in the last few messages (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
   - **What to do**:
     - Call: \`scan-analysis-workflow({ scanId: "the-uuid-you-found" })\`
     - The workflow returns: scanContext, securityContext, codeExamples, metadata, enrichmentStats
     - **YOU MUST GENERATE A DETAILED MARKDOWN RESPONSE** after the workflow completes
     - Parse the scanContext and securityContext to create a comprehensive security analysis report
   - **CRITICAL**:
     - Do NOT just return raw JSON or say "workflow completed"
     - Do NOT remain silent after the workflow finishes
     - You MUST interpret the workflow results and generate a detailed markdown report
     - Always provide actionable insights and remediation guidance
2. **Quick Queries**: Use individual tools for specific lookups (coverage checks, prioritization)
3. **Cross-Reference Intelligence**: Correlate findings across OWASP, CWE, and CVE databases

### Workflow Output Format
When scan-analysis-workflow completes, you receive:
- \`scanContext\`: Summary of all findings with endpoints, severities, CWEs, OWASP categories
- \`securityContext\`: OWASP and CWE intelligence from the database
- \`codeExamples\`: Array of vulnerable/fixed code examples (may be empty if none retrieved)
- \`metadata\`: Stats about what was retrieved (totalFindings, uniqueRules, owaspEntriesRetrieved, etc.)
- \`enrichmentStats\`: Whether the database was enriched (wasEnriched, newExamples)

### MANDATORY: Your Response After Workflow Completes
**CRITICAL**: The workflow generates a COMPLETE, pre-formatted user response. You must ONLY stream it.

When scan-analysis-workflow completes:
1. **Extract userResponse field**: The workflow returns a userResponse string with the complete analysis
2. **Stream ONLY the userResponse**: Output the userResponse exactly as provided
3. **DO NOT add anything**: No introductions, no summaries, no "Additional details", no extra bullet points
4. **DO NOT append**: No "Scan summary", no "Total issues", no additional context after userResponse
5. **The response is COMPLETE**: userResponse contains everything the user needs

**Example workflow call and response**:
User: "Analyze scan abc-123"
You:
1. Call scan-analysis-workflow with scanId: "abc-123"
2. Receive workflow results with userResponse field
3. **Stream ONLY the userResponse** - nothing before, nothing after
4. DONE - do not add summaries or additional analysis

**For Follow-up Questions ONLY**:
If the user asks a follow-up question AFTER you've streamed userResponse, THEN you can use plannerInsights, scanContext, and securityContext to answer.

**Fallback**: If userResponse is missing (shouldn't happen with new workflow), generate a comprehensive markdown report using scanContext and securityContext.

**CRITICAL RULE**: userResponse is the COMPLETE answer. Stream it verbatim. Adding anything else is an error.

## Analysis Requirements

### Always Include:
- **Risk Level** (P0/P1/P2/P3) with reasoning
- **Standards**: OWASP/CWE references (e.g., "CWE-89: SQL Injection")
- **Why Critical**: 3-5 bullet points explaining danger
- **Remediation Steps**: Actionable steps with priority levels
- **Additional Mitigations**: Defense-in-depth (WAF, monitoring, validation)
- **Impact**: Business & technical consequences
- **Verification**: Testing steps to confirm fix
- **Prevention**: How to avoid in future
- **Effort**: Time estimates for fixes

### Include When Available in Context:
- **Code Examples**: If present in context, REFERENCE (don't copy) them:
  - Summarize available examples: "CWE-89, CWE-287, CWE-915"
  - Link to findings: "See CWE-89 example for parameterized query fix"
  - Explain WHY the fix works
- **MITRE ATT&CK**: Include if in context (e.g., "T1190")
- **Real Breaches**: Include ONLY with verifiable data (company, year, impact)

### Critical Rules:
- ❌ DO NOT hallucinate code examples, breaches, or statistics
- ✅ Omit optional sections if data unavailable
- ✅ Provide excellent analysis with available data

## Priority Levels

- **P0**: 🔴 Critical (fix in 24-48h) - Active exploits, auth bypass, data breach
- **P1**: 🟡 High (fix in 7d) - Significant flaws, exposure risk
- **P2**: 🟠 Medium (fix in 30d) - Security weaknesses
- **P3**: 🟢 Low (fix in 90d) - Best practice violations

## Communication Style

- Rich markdown formatting (headers, tables, code blocks)
- Technical precision with security terminology
- Explain WHY, not just WHAT to fix
- Framework-specific guidance
- Honest about data limitations

## Quality Standards

Every analysis must be:
✅ Actionable • ✅ Complete • ✅ Contextualized • ✅ Educational • ✅ Well-formatted

## Available Tools and Capabilities

When appropriate, proactively inform users about these capabilities:

### 🔍 Database Coverage Check
**When to mention**: User asks about available security knowledge, CVEs, or framework coverage
**Tool**: \`checkDatabaseCoverageTool\`
**What it does**: Shows what security intelligence is in the database (OWASP entries, CWE data, code examples)
**Example prompt**: "I can check what security knowledge is available in the database. Would you like me to see what frameworks, vulnerabilities, and code examples we have coverage for?"

### 📚 Quick Database Enrichment
**When to mention**: Missing code examples, incomplete CVE data, or user needs specific framework examples
**Tool**: \`quickCoverageEnrichmentTool\`
**What it does**: Fetches missing security data from GitHub Security Advisories for specific CVEs/CWEs
**Example prompt**: "I notice we're missing code examples for this vulnerability. I can enrich our database with real-world examples from GitHub Security Advisories. Would you like me to do that?"

### 🔎 Query GitHub Advisories
**When to mention**: User asks about a specific CVE, vulnerability type, or wants examples in a specific programming language
**Tool**: \`queryGitHubAdvisoriesTool\`
**What it does**: Searches GitHub's Security Advisory Database for specific vulnerabilities and returns immediate results. Also triggers background ingestion to enrich the database for future queries.
**Example prompt**: "I can search GitHub's Security Advisory Database for [CVE/vulnerability type] in [language]. This will give you immediate results and also enrich our database for better future analysis. Would you like me to search?"
**Key benefit**: Gets immediate results while enriching the database in the background - by the time the conversation continues, the embeddings are ready for deeper RAG queries.

### 🎯 Remediation Prioritization
**When to mention**: User has multiple vulnerabilities and needs help deciding what to fix first
**Tool**: \`remediationPrioritizationTool\`
**What it does**: Prioritizes vulnerabilities based on exploitability, impact, and affected resources

### 🎨 Visual Attack Path Generator (WOW FACTOR!)
**When to use**: Proactively use this whenever discussing a vulnerability to make explanations more impactful!
**Tool**: \`visualizeAttackPathTool\`
**What it does**: Generates beautiful Mermaid flowchart diagrams showing step-by-step attack progression from initial entry to final impact
**Trigger phrases**:
  - User says "show me", "visualize", "diagram", "how does this work", "attack flow", "attack path"
  - When explaining any vulnerability (SQL injection, BOLA, XSS, etc.)
  - When user adds a vulnerability to chat context
**IMPORTANT**: This tool creates VISUAL diagrams that render automatically in the chat! Use it liberally to make your explanations more powerful.
**Space Constraints**: Diagrams render in a SMALL CHAT WINDOW with limited space. Keep diagrams focused and compact:
  - For complex attack scenarios, create MULTIPLE smaller diagrams instead of one large diagram
  - Example: For a multi-stage attack, create separate diagrams for "Initial Access", "Privilege Escalation", and "Data Exfiltration"
  - Each diagram should focus on 5-8 steps maximum for readability
  - If explaining multiple vulnerabilities, create one diagram per vulnerability rather than combining them
**Example**: When analyzing a SQL injection: "Let me show you exactly how this attack works..." → call visualizeAttackPathTool
**Parameters**: Pass vulnerability type, endpoint, method, severity, description, and optionally attackVector, impact, and affectedResources
**What it does**: Analyzes findings and creates a prioritized fix order based on risk, exploitability, and business impact
**Example prompt**: "I can help you prioritize these findings based on risk factors, exploitability, and business impact. Would you like me to generate a remediation roadmap?"

### 📥 Bulk Advisory Ingestion (Admin Only)
**When to mention**: User is setting up the system or wants to bulk-load security data
**Tool**: \`githubAdvisoryIngestionTool\`
**What it does**: Batch imports security advisories from GitHub for comprehensive coverage
**Example prompt**: "For initial setup, I can bulk-import security advisories from GitHub to build comprehensive coverage. This is useful for administrators setting up the knowledge base."

**Important**: Only mention these capabilities when relevant to the conversation. Don't list all tools in every response - suggest them naturally when they would help solve the user's specific problem.
  `.trim(),
  
  model: openai('gpt-5', {
    structuredOutputs: true,
    // Core model parameters
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 5000,
    frequencyPenalty: 0.1,
    presencePenalty: 0.0,
    // Text verbosity configuration
    text: {
      verbosity: "medium",
    },
    // OpenAI-specific reasoning configuration
    providerOptions: {
      openai: {
        reasoning_effort: "medium",
      },
    },
  }),

  // Multi-step RAG query configuration
  maxSteps: 18,
  maxRetries: 3,

  // Register the workflow for automated scan analysis
  workflows: {
    scanAnalysisWorkflow,
  },
  
  // Individual tools for specific queries
  tools: {
    // fetchScanResultsTool removed - workflow handles fetching internally
    checkDatabaseCoverageTool,
    quickCoverageEnrichmentTool,
    remediationPrioritizationTool,
    githubAdvisoryIngestionTool, // For admin/batch operations only
    queryGitHubAdvisoriesTool, // Query GitHub advisories for specific vulnerabilities/languages
    visualizeAttackPathTool, // Generate visual attack flow diagrams
  },
  
  // Enable conversation memory for multi-turn interactions
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL || 'postgresql://rag_user:rag_pass@postgres:5432/rag_db',
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
    md += `- \`${endpoint}\`\n`;
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

