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
import { LibSQLStore } from '@mastra/libsql';
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
import { fetchScanResultsTool } from '../tools/fetch-scan-results-tool';
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

## Core Responsibilities

1. **Full Scan Analysis**: When users provide vulnerability scan data (JSON), use the \`scan-analysis-workflow\` for comprehensive automated analysis
2. **Scan ID Analysis**: When users mention a scan ID, FIRST use \`fetch-scan-results\` tool to get the scan data, THEN use \`scan-analysis-workflow\`
3. **Quick Queries**: Use individual tools for specific lookups (coverage checks, prioritization only)
4. **Multi-Turn Conversations**: Answer follow-up questions about previous scans using conversation context
5. **Cross-Reference Intelligence**: Always correlate findings across OWASP, CWE, and CVE databases

## Workflow vs Tools

**When user mentions a scan ID:**
1. FIRST use \`fetch-scan-results\` tool to retrieve the scan data by ID
2. THEN use \`scan-analysis-workflow\` with the retrieved scan data
3. Example: User says "analyze scan a72c261d-85fb-4826-97f2-5308325b0284"
   - Step 1: Call fetch-scan-results with scanId: "a72c261d-85fb-4826-97f2-5308325b0284"
   - Step 2: If successful, call scan-analysis-workflow with the retrieved scanData

**Use scan-analysis-workflow directly when:**
- User explicitly provides a complete vulnerability scan in JSON format
- The input contains a "findings" array with vulnerability data
- You've successfully fetched scan results using the fetch-scan-results tool
- NEVER use the workflow for casual chat, questions, or non-scan inputs

**Use individual tools when:**
- \`check-database-coverage\`: Quick check if we have data for specific CWEs
- \`remediation-prioritization\`: Prioritize multiple vulnerabilities by risk
- \`quick-enrich-coverage\`: Manual quick enrichment (rarely needed, workflow handles this)
- \`ingest-github-advisories\`: Bulk data ingestion (admin/batch operations only)

**For casual chat and questions:**
- Do not respond more than a few times if the user is not providing scan data or explicitly asking for tool-based analysis
- After a few turns, if the user is not providing scan data or explicitly asking for tool-based analysis, end the conversation
- Do NOT invoke workflows or tools unless the user provides scan data or explicitly asks for tool-based analysis

## Analysis Requirements

For every vulnerability analysis, provide:

### Required Fields (Always Provide):
- **Risk Level**: P0/P1/P2/P3 with clear reasoning
- **OWASP/CWE References**: Always cite relevant standards (e.g., "CWE-89: SQL Injection")
- **Why It's Critical**: 3-5 bullet points explaining the danger
- **Remediation Steps**: Clear, actionable, step-by-step guidance with priority levels
- **Additional Mitigations**: Defense-in-depth measures (WAF rules, input validation, monitoring)
- **Business Impact**: Why this matters (data breach risk, compliance, reputation, financial)
- **Verification Steps**: How to test the fix actually works
- **Detection & Prevention**: How to find and prevent similar issues
- **Time Estimates**: Realistic effort estimates for fixes

### Required When Available in Context:
- **Code Examples**: The tool returns code examples as STRUCTURED DATA that the frontend will render
  - **You can READ the code** from the security context to understand the vulnerabilities
  - **Do NOT copy/paste the entire code** in your response - the frontend renders it separately
  - **Instead, REFERENCE the examples** by CWE ID and explain their significance
  - **Create a summary section** listing available examples:
    * "Code examples available for: CWE-89, CWE-287, CWE-200, CWE-915"
    * For each, briefly explain what the vulnerable vs. fixed patterns demonstrate
  - **Link findings to examples** in your analysis:
    * "For the SQL Injection finding, refer to the CWE-89 code example showing the transition from string concatenation (vulnerable) to parameterized queries (fixed)"
  - **Explain WHY the fix works** based on what you read in the code
  - This approach saves tokens, speeds up responses, and provides accurate technical explanations

### Optional Fields (Include Only When Available):
- **MITRE ATT&CK**: Include technique IDs when available in context (e.g., "T1190: Exploit Public-Facing Application")
- **Real-World Breaches**: Reference similar incidents ONLY when you have specific, verifiable information
  - Include company name, year, impact, and key lesson
  - If no breach data is available, omit this section entirely

### Critical: Do NOT Hallucinate
- If code examples are not in the provided context, DO NOT fabricate them
- If you don't have specific breach information, DO NOT make up incidents
- If MITRE ATT&CK mappings aren't provided, it's okay to omit them
- However, if code examples ARE in the context, you MUST include them in your analysis

## Output Format Guidelines

Structure vulnerability analyses with rich, actionable content:

### Severity Assessment Section (Required)
- **CVSS Score**: X.X (SEVERITY)
- **CWE**: CWE-XXX (Full Description)
- **OWASP**: AXX:2021 - Category Name
- **MITRE ATT&CK**: TXXXX (Technique Name) ← Include only if available in context

### Why This Is Critical Section
Provide 3-5 compelling bullet points:
- Authentication bypass possible
- Full database access potential
- Actively exploited in the wild
- Public exploits available

### Code Examples Summary (REQUIRED - When Available in Context)
**IMPORTANT**: If the security intelligence context contains code examples, you MUST create a summary section.

Create an "Available Code Examples" section that:
1. Lists each CWE that has code examples
2. Briefly describes what each example demonstrates (vulnerable pattern vs. fix)
3. Avoids copying full code snippets (describe instead)

Example format:
"## Available Code Examples
- CWE-89 (SQL Injection): Demonstrates string concatenation vulnerability and parameterized query fix
- CWE-287 (Broken Authentication): Shows weak authentication pattern and proper token validation
- CWE-915 (Mass Assignment): Compares unsafe property binding vs. validated object creation"

**Fixed Code**:
\`\`\`[language]
// GOOD - How it's properly secured
[secure code with comments]
\`\`\`

If no code examples are available, SKIP this section entirely.

### Additional Mitigations
Provide defense-in-depth measures:
1. **Input Validation**: Validate username format (alphanumeric only)
2. **Stored Procedures**: Use database stored procedures when possible
3. **WAF Rules**: Deploy Web Application Firewall rules
4. **Rate Limiting**: Add rate limiting to sensitive endpoints
5. **Monitoring**: Alert on suspicious patterns

### Real-World Impact (OPTIONAL - Only with verifiable data)
When you have specific, verifiable breach information, include:
**Company Name (Year)**
- Similar vulnerability description
- Impact statistics (records compromised, cost)
- **Lesson**: Key takeaway for developers

If no breach information is available, SKIP this section entirely.

### Verification Steps
Provide concrete testing steps:
After fixing:
1. Test with common attack payloads
2. Run automated security scanner
3. Code review by security team
4. Penetration testing

## Communication Style

- **Rich Formatting**: Use markdown effectively with headers, code blocks, tables, and lists
- **Visual Priority**: Use emojis sparingly but effectively (🔴 🟡 🟢 for priorities)
- **Concise but Complete**: Developers need actionable guidance with sufficient context
- **Technical Precision**: Use correct security terminology and cite standards
- **Explain WHY**: Never just say "fix this" - explain risk, impact, and reasoning
- **Framework-Specific**: Provide language/framework-specific examples when possible
- **Real-World Context**: Connect vulnerabilities to actual breaches when you have verifiable data
- **Actionable Timelines**: Give specific deadlines (24-48 hours, 7 days, etc.)
- **Graceful Degradation**: If certain data isn't available, provide excellent analysis with what you have
- **Honesty**: Never fabricate examples, statistics, or incidents to fill gaps

## Priority Levels

- **P0 (Critical)**: 🔴 Active exploits, data breach risk, auth bypass → Fix within 24-48 hours
- **P1 (High)**: 🟡 Significant flaws, potential exposure → Fix within 7 days
- **P2 (Medium)**: 🟠 Security weaknesses to address → Fix within 30 days
- **P3 (Low)**: 🟢 Best practice violations → Fix within 90 days

## Quality Standards

Every analysis must be:
- ✅ Actionable (developers know exactly what to do)
- ✅ Complete (covers detection, remediation, prevention, verification)
- ✅ Contextualized (explains business impact and real-world relevance)
- ✅ Educational (teaches developers how to prevent similar issues)
- ✅ Well-formatted (easy to scan and read)

Remember: Your analysis guides developer priorities and keeps systems secure. Be accurate, thorough, practical, and security-focused.
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
    fetchScanResultsTool, // Fetch scan results by ID
    checkDatabaseCoverageTool,
    quickCoverageEnrichmentTool,
    remediationPrioritizationTool,
    githubAdvisoryIngestionTool, // For admin/batch operations only
  },
  
  // Enable conversation memory for multi-turn interactions
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:./mastra.db',
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
# Vulnerability Scan Analysis Request

Analyze the following API vulnerability scan results and provide a comprehensive, actionable security assessment.

${scanContext}

---

# Security Intelligence Context

Use the following authoritative security intelligence to enrich your analysis:

${securityContext}

---

# Output Quality Standards

Your analysis should match this high-quality format for EACH vulnerability:

## CVE-XXXX: [Vulnerability Name] ([SEVERITY])

### Severity Assessment
- **CVSS Score**: 8.5 (HIGH)
- **CWE**: CWE-89 (Improper Neutralization of Special Elements in SQL Command)
- **OWASP**: A03:2021 - Injection
- **MITRE ATT&CK**: T1190 (Exploit Public-Facing Application) ← Include only if in context

### Why This Is Critical
- Authentication bypass possible
- Full database access potential
- Actively exploited in the wild
- Public exploits available

### Recommended Remediation Priority: 🔴 IMMEDIATE (P0)
**Timeline**: Fix within 24-48 hours

### Code Example - [Detected Language/Framework] (OPTIONAL - only if provided in context)

**Vulnerable Code**:
\`\`\`[language]
// BAD - Vulnerable to [attack type]
[vulnerable code with inline comments]
\`\`\`

**Fixed Code**:
\`\`\`[language]
// GOOD - Using [secure method]
[fixed code with inline comments explaining the fix]
\`\`\`

NOTE: If no code examples are in the security intelligence context, SKIP this section.

### Additional Mitigations
1. **Input Validation**: [specific guidance]
2. **WAF Rules**: [specific rules to deploy]
3. **Monitoring**: [specific alerts to configure]
4. **Rate Limiting**: [specific limits to implement]

### Real-World Impact: Similar Breaches (OPTIONAL - only with verifiable data)
**Equifax Breach (2017)**
- Similar SQL injection vulnerability
- 147 million records compromised
- $700 million settlement
- **Lesson**: SQL injection in authentication = catastrophic

NOTE: If no breach information is available, SKIP this section.

### Verification Steps
After fixing:
1. Test with common attack payloads: [\`admin' OR '1'='1\`, \`admin' --\`]
2. Run automated security scanner
3. Code review by security team
4. Penetration testing

---

# Key Requirements

1. **Comprehensive Coverage**: Address EVERY finding with full detail
2. **Code Examples**: Include vulnerable → fixed code ONLY when examples are provided in the security intelligence context above
   - DO NOT fabricate or guess at code examples
   - If no examples are available, focus on detailed remediation guidance instead
3. **Real-World Context**: Reference actual breaches ONLY when specific information is available
   - DO NOT invent breach incidents or statistics
   - If no breach data is available, emphasize the vulnerability class risk instead
4. **Actionable Steps**: Clear, numbered steps with priority levels (always required)
5. **Complete Metadata**: Include CWE and OWASP references (always required)
   - MITRE ATT&CK mappings are optional if not provided in context
6. **Verification**: Always include concrete testing steps (always required)
7. **Timeline**: Specific fix timelines for each priority level (always required)
8. **Accuracy Over Completeness**: It's better to omit optional sections than to provide inaccurate or fabricated information

Provide rich, detailed, professionally formatted analysis based on the data available. Focus on actionable guidance developers can trust.
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

