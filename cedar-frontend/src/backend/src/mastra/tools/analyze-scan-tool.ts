/**
 * Analyze Scan Tool
 * 
 * This tool processes vulnerability scan results and retrieves relevant security context
 * from the database to provide comprehensive analysis.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  preprocessScan,
  generateLLMContext,
  extractUniqueCWEs,
  type RawScanResult,
} from '../lib/scan-processor';
import {
  retrieveAndRerankContext,
  formatCompleteContext,
  initializePgClient,
  closePgClient,
  retrieveCodeExamplesForCWEs,
  type RetrievalConfig,
} from '../lib/retrieval';
import { validateEnvironment } from '../lib/database-auth';

export const analyzeScanTool = createTool({
  id: 'analyze-scan',
  description: `Analyzes vulnerability scan results by:
1. Preprocessing the scan data to group and deduplicate findings
2. Retrieving relevant OWASP and CWE security intelligence from the database
3. Formatting the context for comprehensive analysis

Use this tool when the user provides a vulnerability scan JSON file or scan results data.`,
  
  inputSchema: z.object({
    scanData: z.string().describe('The vulnerability scan JSON data as a string'),
  }),
  
  outputSchema: z.object({
    scanContext: z.string().describe('Formatted scan summary for analysis'),
    securityContext: z.string().describe('Retrieved OWASP and CWE intelligence'),

    // PHASE 2: Structured code examples for frontend rendering
    codeExamples: z.array(z.object({
      cwe_id: z.string(),
      language: z.string(),
      example_type: z.enum(['vulnerable', 'fixed', 'exploit']),
      code: z.string(),
      explanation: z.string(),
      source_url: z.string().optional(),
    })).describe('Raw code examples for frontend to render natively (agent can read from securityContext)'),

    metadata: z.object({
      totalFindings: z.number(),
      uniqueRules: z.number(),
      owaspEntriesRetrieved: z.number(),
      cweEntriesRetrieved: z.number(),
      codeExamplesRetrieved: z.number().optional(),
    }),
  }),
  
  execute: async ({ context, mastra }) => {
    const { scanData } = context;
    
    const logger = mastra?.getLogger();
    logger?.info('🔍 Analyze Scan Tool - Starting...');
    
    try {
      // Parse the scan JSON
      logger?.info('📝 Parsing scan JSON data...');
      const scan: RawScanResult = JSON.parse(scanData);
      
      // Step 1: Preprocess scan
      logger?.info('📊 Preprocessing scan results...');
      const processed = preprocessScan(scan);
      logger?.info(`✅ Processed ${processed.summary.totalFindings} findings into ${processed.summary.uniqueRules.length} unique types`, {
        totalFindings: processed.summary.totalFindings,
        uniqueRules: processed.summary.uniqueRules.length,
      });
      
      // Step 2: Retrieve security intelligence
      logger?.info('🔍 Retrieving security intelligence from database...');

      let owaspData: any[] = [];
      let cweData: any[] = [];
      let codeExamples: any[] = [];

      // Check if database is configured
      // Validate environment before proceeding
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(
        `Missing required environment variables: ${envValidation.missing.join(', ')}. ` +
        'Please configure your environment variables for database access.'
      );
    }

    // Log any warnings
    if (envValidation.warnings.length > 0) {
      console.log('⚠️  Environment warnings:', envValidation.warnings.join('; '));
    } else {
        try {
          const config: RetrievalConfig = {
            connectionString: process.env.DATABASE_URL!,
            mistralApiKey: process.env.MISTRAL_API_KEY!,
            openaiApiKey: process.env.OPENAI_API_KEY!,
          };

          const retrieved = await retrieveAndRerankContext(processed, config, {
            owaspTopK: 3,  // Get top 3 OWASP entries
            cweTopK: 5,    // Get top 5 CWE entries
          });

          owaspData = retrieved.owaspData;
          cweData = retrieved.cweData;

          logger?.info(`✅ Retrieved security intelligence`, {
            owaspEntries: owaspData.length,
            cweEntries: cweData.length,
          });

          // Step 2.5: Retrieve code examples for the CWEs
          logger?.info('🔍 Retrieving code examples...');
          const cweIds = extractUniqueCWEs(processed);
          const client = await initializePgClient(config.connectionString);

          try {
            codeExamples = await retrieveCodeExamplesForCWEs(client, cweIds, {
              limit: 10,  // Get up to 10 focused examples (quality over quantity)
            });
            logger?.info(`✅ Retrieved ${codeExamples.length} code examples`);
          } catch (error) {
            logger?.error('Failed to retrieve code examples', { error });
          } finally {
            await closePgClient();
          }
        } catch (error) {
          logger?.error('❌ Database connection error, continuing without security intelligence', { error });
          // Continue with empty arrays
        }
      }

      // Step 3: Format contexts
      logger?.info('📄 Formatting context for analysis...');
      const scanContext = generateLLMContext(processed);

      // Format code examples for LLM context
      let codeExamplesContext = '';
      if (codeExamples.length > 0) {
        codeExamplesContext = '\n\n## Code Examples (Vulnerable → Fixed)\n\n';
        codeExamples.forEach((example) => {
          codeExamplesContext += `### ${example.cwe_id} - ${example.language} (${example.example_type})\n\n`;
          codeExamplesContext += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
          codeExamplesContext += `**Explanation**: ${example.explanation}\n\n`;
        });
      }

      const securityContext = formatCompleteContext(owaspData, cweData) + codeExamplesContext;

      const estimatedTokens = Math.round((scanContext.length + securityContext.length) / 4);
      logger?.info(`✅ Context prepared`, { estimatedTokens });

      return {
        scanContext,
        securityContext,

        // PHASE 2: Return structured code examples for frontend
        codeExamples: codeExamples.map(ex => ({
          cwe_id: ex.cwe_id,
          language: ex.language,
          example_type: ex.example_type as 'vulnerable' | 'fixed' | 'exploit',
          code: ex.code,
          explanation: ex.explanation,
          source_url: ex.source_url,
        })),

        metadata: {
          totalFindings: processed.summary.totalFindings,
          uniqueRules: processed.summary.uniqueRules.length,
          owaspEntriesRetrieved: owaspData.length,
          cweEntriesRetrieved: cweData.length,
          codeExamplesRetrieved: codeExamples.length,
        },
      };
      
    } catch (error) {
      logger?.error('❌ Error in analyze-scan tool', { error });
      throw new Error(`Failed to analyze scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

