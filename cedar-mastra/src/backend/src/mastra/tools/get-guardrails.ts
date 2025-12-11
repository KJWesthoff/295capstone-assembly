/**
 * Get Guardrails Tool
 *
 * Fetches security guardrail rules from Semgrep Registry for a given vulnerability type.
 * These rules can be added to CI/CD pipelines to prevent similar vulnerabilities.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  getGuardrailsByCWE,
  getGuardrailsByKeyword,
  getGuardrailsForFinding,
  type GuardrailRule,
} from '../lib/semgrep-client';

export const getGuardrailsTool = createTool({
  id: 'get-guardrails',
  description: `Fetch security guardrail rules from Semgrep Registry.

Use this tool when:
- A user wants to prevent a vulnerability type from recurring
- You need to recommend CI/CD security checks
- The user asks about static analysis rules for a CWE/vulnerability

Examples:
- "Get SQL injection guardrails for Python" -> { cweId: "CWE-89", language: "python" }
- "What rules can prevent XSS?" -> { keyword: "xss" }
- "Guardrails for CWE-78 in JavaScript" -> { cweId: "CWE-78", language: "javascript" }`,

  inputSchema: z.object({
    cweId: z.string().optional().describe('CWE ID to search for (e.g., "CWE-89" or "89")'),
    cweIds: z.array(z.string()).optional().describe('Multiple CWE IDs to search for'),
    keyword: z.string().optional().describe('Keyword to search for (e.g., "sql injection", "xss")'),
    language: z.string().optional().describe('Programming language filter (e.g., "python", "javascript", "java")'),
    limit: z.number().default(3).describe('Maximum number of rules to return'),
  }),

  outputSchema: z.object({
    guardrails: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      severity: z.enum(['ERROR', 'WARNING', 'INFO']),
      language: z.string(),
      pattern: z.string().optional(),
      fix: z.string().optional(),
      cwe: z.array(z.string()),
      owasp: z.array(z.string()),
      references: z.array(z.string()),
      sourceUrl: z.string(),
      ruleYaml: z.string(),
      confidence: z.string().optional(),
      impact: z.string().optional(),
    })),
    message: z.string(),
    searchCriteria: z.object({
      cweId: z.string().optional(),
      keyword: z.string().optional(),
      language: z.string().optional(),
    }),
  }),

  execute: async ({ context }) => {
    const { cweId, cweIds, keyword, language, limit = 3 } = context;

    console.log(`🛡️ Fetching guardrails: cwe=${cweId || cweIds?.join(',')}, keyword=${keyword}, lang=${language}`);

    let guardrails: GuardrailRule[] = [];

    try {
      if (cweIds && cweIds.length > 0) {
        // Multiple CWE IDs provided
        guardrails = await getGuardrailsForFinding(cweIds, language, limit);
      } else if (cweId) {
        // Single CWE ID
        guardrails = await getGuardrailsByCWE(cweId, language, limit);
      } else if (keyword) {
        // Keyword search
        guardrails = await getGuardrailsByKeyword(keyword, language, limit);
      } else {
        return {
          guardrails: [],
          message: 'Please provide either a CWE ID or keyword to search for guardrails.',
          searchCriteria: { cweId, keyword, language },
        };
      }

      const message = guardrails.length > 0
        ? `Found ${guardrails.length} Semgrep rule(s) for ${cweId || keyword}${language ? ` in ${language}` : ''}.`
        : `No guardrail rules found for ${cweId || keyword}${language ? ` in ${language}` : ''}. Try a broader search.`;

      console.log(`   ✅ ${message}`);

      return {
        guardrails,
        message,
        searchCriteria: { cweId: cweId || cweIds?.join(','), keyword, language },
      };
    } catch (error: any) {
      console.error('❌ Error fetching guardrails:', error);
      return {
        guardrails: [],
        message: `Error fetching guardrails: ${error.message}`,
        searchCriteria: { cweId, keyword, language },
      };
    }
  },
});
