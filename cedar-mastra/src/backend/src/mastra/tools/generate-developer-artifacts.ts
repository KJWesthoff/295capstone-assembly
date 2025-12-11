/**
 * Generate Developer Artifacts Tool
 *
 * Uses AI to generate contextual unit tests, integration tests, and PR metadata
 * based on the code fix provided for a vulnerability finding.
 *
 * Only generates artifacts when a real code fix is available.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

// Schema for the generated artifacts
const GeneratedArtifactsSchema = z.object({
  unitTests: z.object({
    code: z.string().describe('Generated unit test code'),
    language: z.string().describe('Programming language of the tests'),
    framework: z.string().describe('Test framework used (e.g., Jest, PHPUnit, pytest)'),
    testCases: z.array(z.object({
      name: z.string().describe('Test case name'),
      purpose: z.string().describe('What this test validates'),
    })).describe('Summary of test cases included'),
    runCommand: z.string().describe('Command to run these tests'),
  }).describe('Generated unit tests for the fix'),

  integrationTests: z.object({
    code: z.string().describe('Generated integration test code'),
    language: z.string().describe('Programming language of the tests'),
    framework: z.string().describe('Test framework used'),
    testCases: z.array(z.object({
      name: z.string().describe('Test case name'),
      purpose: z.string().describe('What this test validates'),
    })).describe('Summary of integration test cases'),
    runCommand: z.string().describe('Command to run these tests'),
    dependencies: z.array(z.string()).optional().describe('Additional dependencies needed'),
  }).describe('Generated integration tests'),

  pullRequest: z.object({
    branchName: z.string().describe('Suggested branch name'),
    commitMessage: z.string().describe('Commit message following conventional commits'),
    title: z.string().describe('PR title'),
    body: z.string().describe('Full PR body with all sections'),
    labels: z.array(z.string()).describe('Suggested PR labels'),
    reviewChecklist: z.array(z.string()).describe('Items for reviewers to check'),
  }).describe('Generated PR metadata'),

  metadata: z.object({
    generatedAt: z.string(),
    modelUsed: z.string(),
    fixLanguage: z.string(),
    cweAddressed: z.array(z.string()),
    confidenceScore: z.number().min(0).max(100).describe('Confidence in the generated artifacts (0-100)'),
  }),
});

export type GeneratedArtifacts = z.infer<typeof GeneratedArtifactsSchema>;

// Input schema for the tool
const InputSchema = z.object({
  finding: z.object({
    id: z.string(),
    owasp: z.string(),
    cwe: z.array(z.string()),
    cve: z.array(z.string()).optional(),
    severity: z.string(),
    endpoint: z.object({
      method: z.string(),
      path: z.string(),
      service: z.string(),
    }),
    repo: z.string().optional(),
    file: z.string().optional(),
    language: z.string().optional(),
    framework: z.string().optional(),
    nistCsf: z.array(z.string()).optional(),
    nist80053: z.array(z.string()).optional(),
  }).describe('The vulnerability finding'),

  codeFix: z.object({
    vulnerableCode: z.string().describe('The vulnerable code snippet'),
    fixedCode: z.string().describe('The fixed code snippet'),
    language: z.string().describe('Programming language'),
    file: z.string().optional().describe('File path'),
    line: z.number().optional().describe('Line number'),
  }).describe('The code fix context'),

  hotPatch: z.string().optional().describe('Hot patch configuration if available'),
});

export const generateDeveloperArtifactsTool = createTool({
  id: 'generate-developer-artifacts',
  description: `Generate contextual unit tests, integration tests, and PR metadata for a vulnerability fix.

Use this tool when:
- A code fix is available for a vulnerability finding
- The developer needs tests to validate the fix
- A PR needs to be created with proper documentation

This tool generates:
1. Unit tests that verify the fix prevents the vulnerability
2. Integration tests for end-to-end validation
3. Complete PR metadata with security context`,

  inputSchema: InputSchema,
  outputSchema: GeneratedArtifactsSchema,

  execute: async ({ context }) => {
    const { finding, codeFix, hotPatch } = context;

    console.log(`🔧 Generating developer artifacts for finding ${finding.id}`);
    console.log(`   Language: ${codeFix.language}, CWEs: ${finding.cwe.join(', ')}`);

    const prompt = `Generate comprehensive developer artifacts for fixing a security vulnerability.

## Vulnerability Context

**Finding ID**: ${finding.id}
**Severity**: ${finding.severity}
**OWASP**: ${finding.owasp}
**CWE**: ${finding.cwe.join(', ')}
**CVE**: ${finding.cve?.join(', ') || 'N/A'}
**Endpoint**: ${finding.endpoint.method} ${finding.endpoint.path}
**Service**: ${finding.endpoint.service}
**Repository**: ${finding.repo || 'Unknown'}
**File**: ${finding.file || codeFix.file || 'Unknown'}
**Language**: ${codeFix.language}
**Framework**: ${finding.framework || 'Unknown'}

## Code Fix

### Vulnerable Code
\`\`\`${codeFix.language}
${codeFix.vulnerableCode}
\`\`\`

### Fixed Code
\`\`\`${codeFix.language}
${codeFix.fixedCode}
\`\`\`

${hotPatch ? `### Hot Patch Available
\`\`\`
${hotPatch}
\`\`\`
` : ''}

## Requirements

Generate:

1. **Unit Tests**: Tests that specifically validate the security fix
   - Test that malicious input is rejected/sanitized
   - Test that normal input still works correctly
   - Test edge cases relevant to the vulnerability type
   - Use appropriate testing framework for ${codeFix.language}

2. **Integration Tests**: End-to-end tests
   - Test the API endpoint with attack payloads
   - Verify proper HTTP status codes and responses
   - Test authentication/authorization if relevant

3. **Pull Request**: Complete PR documentation
   - Branch name following git-flow conventions
   - Commit message following conventional commits
   - Comprehensive PR body with:
     - Summary of the vulnerability fix
     - Security context (CVE, CWE, OWASP, NIST mappings)
     - Changes made
     - Test plan
     - Risk assessment
     - Verification steps
   - Appropriate labels (security, priority level)
   - Reviewer checklist

## Compliance Context

**NIST CSF**: ${finding.nistCsf?.join(', ') || 'PR.DS-1, PR.DS-2'}
**NIST 800-53**: ${finding.nist80053?.join(', ') || 'SI-10, SI-11'}

Generate production-quality tests and documentation that a security-conscious team would approve.`;

    try {
      const aiResult = await generateObject({
        model: openai('gpt-4o'),
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer and security specialist. Generate high-quality, production-ready tests and PR documentation for vulnerability fixes.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        schema: GeneratedArtifactsSchema,
        temperature: 0.3, // Slightly creative but deterministic
      });

      const artifacts = aiResult.object;

      // Add metadata
      const finalResult: GeneratedArtifacts = {
        ...artifacts,
        metadata: {
          ...artifacts.metadata,
          generatedAt: new Date().toISOString(),
          modelUsed: 'gpt-4o',
          fixLanguage: codeFix.language,
          cweAddressed: finding.cwe,
        },
      };

      console.log(`   ✅ Generated ${finalResult.unitTests.testCases.length} unit tests, ${finalResult.integrationTests.testCases.length} integration tests`);
      console.log(`   ✅ PR: "${finalResult.pullRequest.title}"`);

      return finalResult;
    } catch (error: any) {
      console.error('❌ Error generating developer artifacts:', error);
      throw new Error(`Failed to generate developer artifacts: ${error.message}`);
    }
  },
});
