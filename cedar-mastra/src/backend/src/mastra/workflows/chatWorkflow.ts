// ---------------------------------------------
// Workflows are a Mastra primitive to orchestrate agents and complex sequences of tasks
// Docs: https://mastra.ai/en/docs/workflows/overview
// ---------------------------------------------

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { productRoadmapAgent } from '../agents/productRoadmapAgent';
import { securityAnalystAgent } from '../agents/securityAnalystAgent';
import { streamJSONEvent, handleTextStream } from '../../utils/streamUtils';

// ---------------------------------------------
// Mastra nested streaming – emit placeholder events
// ---------------------------------------------

/**
 * All possible event types that can be emitted by Mastra primitives when using the
 * new nested streaming support (see https://mastra.ai/blog/nested-streaming-support).
 */
export type MastraEventType =
  | 'start'
  | 'step-start'
  | 'tool-call'
  | 'tool-result'
  | 'step-finish'
  | 'tool-output'
  | 'step-result'
  | 'step-output'
  | 'finish';

// Helper array so we can iterate easily when emitting placeholder events.
const mastraEventTypes: MastraEventType[] = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'tool-output',
  'step-result',
  'step-output',
  'finish',
];

// Pre-defined sample event objects that follow the shapes shown in the
// nested-streaming blog post. These are purely illustrative and use mock IDs.
const sampleMastraEvents: Record<MastraEventType, Record<string, unknown>> = {
  start: {
    type: 'start',
    from: 'AGENT',
    payload: {},
  },
  'step-start': {
    type: 'step-start',
    from: 'AGENT',
    payload: {
      messageId: 'msg_123',
      request: { role: 'user', content: 'Hello, world!' },
      warnings: [],
    },
  },
  'tool-call': {
    type: 'tool-call',
    from: 'AGENT',
    payload: {
      toolCallId: 'tc_456',
      args: { foo: 'bar' },
      toolName: 'sampleTool',
    },
  },
  'tool-result': {
    type: 'tool-result',
    from: 'AGENT',
    payload: {
      toolCallId: 'tc_456',
      toolName: 'sampleTool',
      result: { success: true },
    },
  },
  'step-finish': {
    type: 'step-finish',
    from: 'AGENT',
    payload: {
      reason: 'completed',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      response: { text: 'Done!' },
      messageId: 'msg_123',
      providerMetadata: {
        openai: {
          reasoningTokens: 5,
          acceptedPredictionTokens: 10,
          rejectedPredictionTokens: 0,
          cachedPromptTokens: 0,
        },
      },
    },
  },
  'tool-output': {
    type: 'tool-output',
    from: 'USER',
    payload: {
      output: { text: 'Nested output from agent' },
      toolCallId: 'tc_456',
      toolName: 'sampleTool',
    },
  },
  'step-result': {
    type: 'step-result',
    from: 'WORKFLOW',
    payload: {
      stepName: 'exampleStep',
      result: { data: 'example' },
      stepCallId: 'sc_789',
      status: 'success',
      endedAt: Date.now(),
    },
  },
  'step-output': {
    type: 'step-output',
    from: 'USER',
    payload: {
      output: { text: 'Nested output from step' },
      toolCallId: 'tc_456',
      toolName: 'sampleTool',
    },
  },
  finish: {
    type: 'finish',
    from: 'WORKFLOW',
    payload: {
      totalUsage: {
        promptTokens: 15,
        completionTokens: 35,
        totalTokens: 50,
      },
    },
  },
};

// The emitMastraEvents step will be declared after buildAgentContext to ensure
// buildAgentContext is defined before we reference it.

export const ChatInputSchema = z.object({
  prompt: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  systemPrompt: z.string().optional(),
  // Memory linkage (optional)
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  streamController: z.any().optional(),
  // For structured output
  output: z.any().optional(),
  // Cedar OS context from frontend
  additionalContext: z.any().optional(),
});

export const ChatOutputSchema = z.object({
  content: z.string(),
  usage: z.any().optional(),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// 1. fetchContext – passthrough (placeholder)
const fetchContext = createStep({
  id: 'fetchContext',
  description: 'Placeholder step – you might want to fetch some information for your agent here',
  inputSchema: ChatInputSchema,
  outputSchema: ChatInputSchema.extend({
    context: z.any().optional(),
  }),
  execute: async ({ inputData }) => {
    console.log('Chat workflow received input data', inputData);
    console.log('Input data keys:', Object.keys(inputData));
    console.log('Prompt content:', inputData.prompt);

    // [STEP 5] (Backend): If the user adds a node via @mention then sends a message, the agent will receive it here in the user prompt field.
    // [STEP 6] (Backend): If you call the subscribeInputContext hook on the frontend, the agent will receive that state as context, formatted in the way you specified.

    let enhancedPrompt = inputData.prompt;

    // Extract scan ID and vulnerability findings from additionalContext if present
    if (inputData.additionalContext) {
      console.log('Additional context received:', JSON.stringify(inputData.additionalContext, null, 2));

      // Look for scan ID in additionalContext
      let scanId: string | null = null;
      const vulnerabilityFindings: any[] = [];

      // Check scanResults state subscription (from useScanResultsState)
      if (inputData.additionalContext.scanResults) {
        const scanResults = Array.isArray(inputData.additionalContext.scanResults)
          ? inputData.additionalContext.scanResults[0]
          : inputData.additionalContext.scanResults;

        // For subscribed state, scanId is directly on the object (not nested in .data)
        if (scanResults?.scanId) {
          scanId = scanResults.scanId;
          console.log(`Found scan ID in scanResults context: ${scanId}`);
        }
      }

      // Check manual context entries (from addContextEntry button)
      for (const key in inputData.additionalContext) {
        const entries = inputData.additionalContext[key];
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            // Extract scan ID if present
            if (entry.data?.scanId) {
              scanId = entry.data.scanId;
              console.log(`Found scan ID in manual context entry: ${scanId}`);
            }

            // Extract vulnerability findings (from Finding type: id, endpoint, severity, etc.)
            if (entry.data?.id && entry.data?.endpoint && entry.data?.severity) {
              vulnerabilityFindings.push(entry.data);
              console.log(`Found vulnerability finding: ${entry.data.id} - ${entry.data.endpoint.method} ${entry.data.endpoint.path} (${entry.data.severity})`);
            }
          }
        }
      }

      // Format vulnerability findings for the agent
      if (vulnerabilityFindings.length > 0) {
        const formattedFindings = vulnerabilityFindings.map(finding => `
**Vulnerability: ${finding.summaryHumanReadable || finding.id}**
- ID: ${finding.id}
- Severity: ${finding.severity} (CVSS: ${finding.cvss})
- Endpoint: ${finding.endpoint.method} ${finding.endpoint.path}
- Service: ${finding.endpoint.service || 'Unknown'}
- OWASP: ${finding.owasp}
- CWE: ${finding.cwe?.join(', ') || 'N/A'}
- CVE: ${finding.cve?.length > 0 ? finding.cve.join(', ') : 'None'}
- Scanners: ${finding.scanners?.join(', ') || 'Unknown'}
- Status: ${finding.status}
- Exploit Present: ${finding.exploitPresent ? 'Yes' : 'No'}
- Priority Score: ${finding.priorityScore?.toFixed(2) || 'N/A'}
${finding.suggestedFix ? `- Suggested Fix: ${finding.suggestedFix}` : ''}
`).join('\n---\n');

        enhancedPrompt = `${inputData.prompt}

[CONTEXT: User has selected the following vulnerability findings to discuss:]
${formattedFindings}

[ROLE GUIDANCE:]
You are a friendly API security lead helping a small team that cannot afford a full security department.
They have at most a few hours this week to work on security.

Your approach:
- Be conversational and approachable - you're a colleague, not a lecturer
- Start with what matters most, not everything at once
- Ask if they want to dive deeper rather than overwhelming them
- Use plain language - pretend you're explaining to a friend over coffee
- Encourage questions and back-and-forth dialogue

Your job is NOT to list every problem or dump a wall of text. Your job is to:
1) Explain what's at risk in plain language
2) Tell them what to fix TODAY (in a few hours) vs this month
3) Make them feel empowered, not overwhelmed
4) Help them see why this tool is worth using regularly

[COMMUNICATION STYLE:]
Write like you're talking to a colleague, NOT writing a security report:

❌ DON'T DO THIS:
- Excessive section headers ("What to do today:", "Business Impact:", etc.)
- Technical jargon (P0, WAF, ORM, CVSS, CWE, CVE)
- Comprehensive coverage of everything
- Formal tone or audit-report language

✅ DO THIS INSTEAD:
- Write in natural paragraphs like you're explaining over Slack
- Use markdown for clarity: **bold** for emphasis, \`code blocks\` for code examples
- Use everyday language ("this is really bad" not "P0 critical severity")
- Lead with the scariest thing in plain terms
- Suggest 1-2 quick fixes they can do right now
- End with an open question inviting them to dig deeper

Example good response structure:
"Hey, so this **SQL injection** in your login is pretty serious - someone could sign in as admin without knowing the password. The good news is the fix is straightforward: switch to parameterized queries instead of building SQL strings.

\`\`\`python
# Before (vulnerable)
query = f"SELECT * FROM users WHERE username = '{username}'"

# After (secure)
query = "SELECT * FROM users WHERE username = ?"
cursor.execute(query, (username,))
\`\`\`

Want me to show you exactly what that looks like in your code? Or should we talk about which one to tackle first if you have multiple findings?"

Keep it short (2-3 paragraphs max). Make them WANT to ask a follow-up question, don't answer everything upfront.

**CRITICAL: Ensure that your response is in markdown format.**`;
        console.log(`Enhanced prompt with ${vulnerabilityFindings.length} vulnerability findings`);
      }

      // Extract evidence items (from Evidence type: request, response, authContext)
      const evidenceItems: any[] = [];
      for (const key in inputData.additionalContext) {
        const entries = inputData.additionalContext[key];
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (entry.data?.request && entry.data?.response && entry.data?.authContext) {
              evidenceItems.push(entry.data);
              console.log(`Found evidence item: ${entry.data.id}`);
            }
          }
        }
      }

      if (evidenceItems.length > 0) {
        const formattedEvidence = evidenceItems.map(evidence => `
**Evidence for Finding ${evidence.id || 'Unknown'}**
- Auth Context: ${evidence.authContext}
- Request:
\`\`\`http
${evidence.request}
\`\`\`
- Response:
\`\`\`http
${evidence.response}
\`\`\`
${evidence.pocLinks ? `- PoC Links: ${JSON.stringify(evidence.pocLinks)}` : ''}
`).join('\n---\n');

        enhancedPrompt = `${enhancedPrompt}

[CONTEXT: User has provided the following technical evidence:]
${formattedEvidence}`;
        console.log(`Enhanced prompt with ${evidenceItems.length} evidence items`);
      }

      // If scan ID found in context, always inform the agent (let agent decide whether to use it)
      if (scanId) {
        if (vulnerabilityFindings.length === 0) {
          // Scan ID available, inform agent to use scan-analysis-workflow if user asks for analysis
          enhancedPrompt = `${inputData.prompt}

[CONTEXT: Active Scan ID ${scanId} - If user asks for scan analysis/report, call scan-analysis-workflow with this ID]`;
          console.log(`Enhanced prompt with scan ID: ${scanId}`);
        } else {
          // If we have both vulnerability findings and scan ID, add scan ID to the existing enhanced prompt
          enhancedPrompt = `${enhancedPrompt}

[ADDITIONAL CONTEXT: These vulnerabilities are from scan ID ${scanId}]`;
        }
      }
    }

    // Check if the prompt itself mentions a scan ID directly
    const scanIdPattern = /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i;
    const scanIdMatch = inputData.prompt.match(scanIdPattern);

    if (scanIdMatch) {
      const scanId = scanIdMatch[1];
      console.log(`Detected scan ID directly in prompt: ${scanId}`);

      if (!enhancedPrompt.includes(scanId)) {
        enhancedPrompt = `${enhancedPrompt}

[CONTEXT: Scan ID ${scanId} mentioned. Use scan-analysis-workflow to analyze it.]`;
      }
    }

    const result = { ...inputData, prompt: enhancedPrompt, context: inputData };

    console.log('Workflow passing context to agent');

    return result;
  },
});

// 2. buildAgentContext – build message array
const buildAgentContext = createStep({
  id: 'buildAgentContext',
  description: 'Combine fetched information and build LLM messages',
  inputSchema: fetchContext.outputSchema,
  outputSchema: ChatInputSchema.extend({
    messages: z.array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData }) => {
    const { prompt, temperature, maxTokens, streamController, resourceId, threadId } = inputData;

    const messages = [{ role: 'user' as const, content: prompt }];

    const result = {
      ...inputData,
      messages,
      temperature,
      maxTokens,
      streamController,
      resourceId,
      threadId,
    };

    return result;
  },
});

// 2.5 emitMastraEvents – emit a placeholder event for every new Mastra event type
const emitMastraEvents = createStep({
  id: 'emitMastraEvents',
  description: 'Emit placeholder JSON events for every Mastra nested streaming event type',
  inputSchema: buildAgentContext.outputSchema,
  outputSchema: buildAgentContext.outputSchema,
  execute: async ({ inputData }) => {
    const { streamController } = inputData;

    if (streamController) {
      for (const eventType of mastraEventTypes) {
        const sample = sampleMastraEvents[eventType];
        streamJSONEvent(streamController, sample);
      }

      streamJSONEvent(streamController, {
        type: 'alert',
        level: 'info',
        text: 'Mastra events emitted',
      });
      streamJSONEvent(streamController, {
        type: 'unregistered_event',
        level: 'info',
        text: 'Mastra events emitted',
      });
    }

    // Pass data through untouched so subsequent steps receive the original input
    return inputData;
  },
});

// 3. callAgent – invoke chatAgent
const callAgent = createStep({
  id: 'callAgent',
  description: 'Invoke the chat agent with streaming and return final text',
  inputSchema: buildAgentContext.outputSchema,
  outputSchema: ChatOutputSchema,
  execute: async ({ inputData }) => {
    const {
      messages,
      temperature,
      maxTokens,
      streamController,
      systemPrompt,
      resourceId,
      threadId,
    } = inputData;

    try {
      if (streamController) {
        streamJSONEvent(streamController, {
          type: 'progress_update',
          status: 'in_progress',
          text: 'Generating response...',
        });
      }

      // Use security analyst agent for security pages, product roadmap agent for others
      const agent = securityAnalystAgent; // Default to security analyst for now

      console.log('🤖 Starting agent.stream() with maxSteps: 5');
      const streamResult = await agent.stream(messages, {
        ...(systemPrompt ? ({ instructions: systemPrompt } as const) : {}),
        temperature,
        maxTokens,
        maxSteps: 5, // Allow agent to call workflow (step 1) AND generate text response (step 2+)
        ...(resourceId && threadId && { memory: { resource: resourceId, thread: threadId } }),
        onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
          console.log('📊 Agent step finished:', {
            hasText: !!text,
            textLength: text?.length || 0,
            toolCallsCount: toolCalls?.length || 0,
            toolNames: toolCalls?.map(tc => tc.toolName),
            finishReason
          });
        },
      });
      console.log('✅ agent.stream() created, starting text streaming...');

      let finalText = '';
      if (streamController) {
        // Use handleTextStream helper for proper encoding and error handling
        finalText = await handleTextStream(streamResult, streamController);

        // Send completion event only (chunks already rendered by handleTextStream)
        streamJSONEvent(streamController, {
          type: 'progress_update',
          status: 'complete',
          text: 'Response generated',
        });
      } else {
        for await (const chunk of streamResult.textStream) {
          finalText += chunk as string;
        }
      }

      return { content: finalText };
    } catch (error) {
      console.error('Error in callAgent step:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Try to send error to stream if still available
      if (streamController) {
        try {
          // Send error as a visible message
          streamJSONEvent(streamController, {
            type: 'message',
            role: 'assistant',
            content: `⚠️ **Error**: ${errorMessage}\n\nPlease check the Mastra backend logs for details.`,
          });

          streamJSONEvent(streamController, {
            type: 'progress_update',
            status: 'error',
            text: errorMessage,
          });
        } catch (streamError) {
          // Stream is closed, log and continue
          console.debug('Could not send error to stream (already closed)');
        }
      }

      // Return error as content instead of throwing to allow graceful handling
      return { content: `Error: ${errorMessage}` };
    }
  },
});

export const chatWorkflow = createWorkflow({
  id: 'chatWorkflow',
  description:
    'Chat workflow that replicates the old /chat/execute-function endpoint behaviour with optional streaming',
  inputSchema: ChatInputSchema,
  outputSchema: ChatOutputSchema,
})
  .then(fetchContext)
  .then(buildAgentContext)
  .then(callAgent)
  .commit();
