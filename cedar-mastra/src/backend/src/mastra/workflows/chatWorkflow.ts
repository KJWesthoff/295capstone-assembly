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

    // Extract page context to adapt communication style
    let pageType = 'other';
    let pathname = '';

    // Extract scan ID and vulnerability findings from additionalContext if present
    if (inputData.additionalContext) {
      console.log('Additional context received:', JSON.stringify(inputData.additionalContext, null, 2));

      // Look for page context first (key is 'current-page' from usePageContext hook)
      const pageContextKey = inputData.additionalContext['current-page'] || inputData.additionalContext.pageContext;
      if (pageContextKey) {
        const pageContext = Array.isArray(pageContextKey)
          ? pageContextKey[0]
          : pageContextKey;

        if (pageContext?.data) {
          pageType = pageContext.data.pageType || 'other';
          pathname = pageContext.data.pathname || '';
          console.log(`Page context detected: ${pageType} (${pathname})`);
        }
      }

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

        // Extract topFindings from scanResults context (added by useSecurityContext)
        if (scanResults?.topFindings && Array.isArray(scanResults.topFindings)) {
          for (const finding of scanResults.topFindings) {
            vulnerabilityFindings.push({
              id: finding.id,
              severity: finding.severity,
              endpoint: { method: finding.method, path: finding.endpoint, service: 'API' },
              summaryHumanReadable: finding.title || finding.description,
              owasp: finding.rule,
              scanners: [finding.scanner],
              cvss: 0,
              cwe: [],
              cve: [],
              status: 'New',
              exploitPresent: false,
              priorityScore: 0,
            });
          }
          console.log(`Found ${scanResults.topFindings.length} top findings from scanResults context`);
        }

        // Also include summary info for context
        if (scanResults?.summary) {
          console.log(`Scan summary: ${scanResults.summary.total} total, ${scanResults.summary.critical} critical, ${scanResults.summary.high} high`);
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

      // =============================================================================
      // CORE PERSONALITY (Always Applied)
      // =============================================================================
      const corePersonality = `
[ROLE: Venti - Your Security Assistant]
You are Venti, a friendly and knowledgeable security assistant. You work alongside business owners, analysts, and developers to help them understand and address security issues without overwhelming them.

Your core traits:
- **Approachable**: You're a colleague, not a lecturer. Talk like you're helping a friend.
- **Practical**: Focus on what matters most and what they can do right now.
- **Encouraging**: Make security feel manageable, not scary. Celebrate progress.
- **Clear**: Explain things in plain language. Avoid jargon unless talking to technical users.
- **Conversational**: Write in natural paragraphs, not endless bullet points.

Communication style:
- Lead with the most important thing, not comprehensive coverage
- Ask questions to understand their situation before dumping information
- Keep responses short (2-3 paragraphs max unless they ask for more)
- End with an invitation to continue the conversation
- Use **bold** for emphasis, \`code\` for technical terms, but sparingly

**CRITICAL: Ensure that your response is in markdown format.**`;

      // =============================================================================
      // PAGE-SPECIFIC GUIDANCE
      // =============================================================================
      let pageGuidance = '';

      if (pageType === 'executive') {
        pageGuidance = `
[AUDIENCE: Small Business Owner / Executive]
The person you're talking to is likely a small business owner or non-technical executive. They're good at what they do (running a business), but security isn't their specialty. They might be here because:
- They got a scary email about their website being delisted or compromised
- Their payment processor flagged a compliance issue
- They're trying to understand what their developer needs to fix

## CRITICAL: USE THE SCAN DATA YOU HAVE

If you have scan findings in the context below, **USE THEM IMMEDIATELY**. Don't ask generic questions when you already have specific information!

✅ GOOD (uses scan data):
"I can actually see what's going on from your recent scan. Your site has a few security issues that Google probably flagged - the main one is that anyone can access certain pages without logging in properly. That's likely why your Merchant Center got suspended. The good news: this is fixable. Want me to draft an email to your developer explaining exactly what needs to be done?"

❌ BAD (ignores scan data):
"Did Google tell you why? Do you have a developer?" ← DON'T ASK THIS IF YOU ALREADY HAVE SCAN DATA!

## Your approach:
1. **If you have scan data**: Lead with it! Connect the findings to their problem in plain language.
2. **Reassure them**: This is fixable, they're in the right place.
3. **Translate findings to business impact**: "This means someone could see customer data" not "BOLA vulnerability detected"
4. **Focus on the top 1-2 issues**: Don't overwhelm them with everything.
5. **Offer to draft the email**: Your goal is to help them communicate with their developer.

## Connecting scan findings to common business problems:
- **Google suspension** → Usually authentication issues, missing security headers, or data exposure
- **Payment processor issues** → Usually SSL problems, PCI compliance gaps, or insecure data handling
- **"Site hacked" reports** → Look for injection vulnerabilities or authentication bypasses

## Keep it conversational:
- 2-3 paragraphs max
- Plain language (no CVSS, CWE, OWASP, injection, P0/P1)
- End with a clear next step or question
- NEVER conclude - always offer more help`;

      } else if (pageType === 'security-analyst') {
        pageGuidance = `
[AUDIENCE: Security Analyst / Technical Lead]
The person you're talking to understands security concepts but wants efficient, accurate information. They need to:
- Validate and prioritize findings
- Understand exploitability and business impact
- Make informed decisions about remediation

Your approach with them:
- Be technically precise - they understand CVSS, CWE, OWASP
- Focus on exploitability and real-world impact
- Help them prioritize based on risk, not just severity
- Provide actionable next steps
- Reference authoritative sources when relevant

✅ DO THIS:
- Use technical terms appropriately (CWE-89, OWASP API1, etc.)
- Explain attack scenarios and exploitability
- Help with prioritization logic
- Suggest validation steps`;

      } else if (pageType === 'developer') {
        pageGuidance = `
[AUDIENCE: Developer / Engineer]
The person you're talking to can write code and wants to fix things. They need:
- Clear understanding of what's vulnerable and why
- Code examples showing the fix
- Guidance on testing the fix worked

Your approach with them:
- Lead with code examples (before/after)
- Explain the root cause briefly
- Suggest how to test the fix
- Mention any quick mitigations while they implement the full fix

✅ DO THIS:
- Show vulnerable vs fixed code snippets
- Explain WHY the fix works
- Suggest unit tests or validation steps
- Keep explanations concise - they can ask for more detail`;

      } else {
        // Home page or other - be welcoming and guide them
        pageGuidance = `
[AUDIENCE: New or General User]
Welcome them and help them understand what they can do here. Guide them to the right dashboard based on their role.`;
      }

      // =============================================================================
      // BUILD ENHANCED PROMPT - AUDIENCE CONTEXT GOES FIRST!
      // =============================================================================
      // Structure: [AUDIENCE] -> [USER MESSAGE] -> [OPTIONAL CONTEXT]
      // This ensures the agent ALWAYS sees who they're talking to first.

      let contextSections: string[] = [];

      // Format vulnerability findings if present
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

        contextSections.push(`[SELECTED FINDINGS:]\n${formattedFindings}`);
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

        contextSections.push(`[TECHNICAL EVIDENCE:]\n${formattedEvidence}`);
      }

      // Add scan ID context if available
      if (scanId) {
        contextSections.push(`[ACTIVE SCAN: ${scanId}]`);
      }

      // BUILD FINAL PROMPT: Audience FIRST, then user message, then optional context
      const optionalContext = contextSections.length > 0 ? `\n\n${contextSections.join('\n\n')}` : '';

      enhancedPrompt = `${pageGuidance}

${corePersonality}

---
USER MESSAGE: ${inputData.prompt}
---${optionalContext}`;

      console.log(`Enhanced prompt with ${pageType} audience context, ${vulnerabilityFindings.length} findings, ${evidenceItems.length} evidence items`);
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

// 2. buildAgentContext – build message array with conversation history
const buildAgentContext = createStep({
  id: 'buildAgentContext',
  description: 'Combine fetched information and build LLM messages with conversation history',
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

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // Use effective IDs (same logic as callAgent step)
    const effectiveResourceId = resourceId && resourceId.trim() !== ''
      ? resourceId
      : 'default-user';
    const effectiveThreadId = threadId && threadId.trim() !== ''
      ? threadId
      : 'default-thread';

    // Fetch conversation history from storage
    try {
      const { storage } = await import('../storage');

      // Check if thread exists
      const thread = await storage.getThreadById({ threadId: effectiveThreadId });

      if (thread) {
        // Fetch recent messages (last 10 for context)
        const storedMessages = await storage.getMessagesPaginated({
          threadId: effectiveThreadId,
          format: 'v2',
          selectBy: { last: 10 },
        });

        if (storedMessages?.messages && storedMessages.messages.length > 0) {
          console.log(`📜 Found ${storedMessages.messages.length} previous messages in thread ${effectiveThreadId}`);

          // Add previous messages to context (excluding system messages)
          for (const msg of storedMessages.messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              // Extract text content from message
              let content = '';
              if (typeof msg.content === 'string') {
                content = msg.content;
              } else if (Array.isArray(msg.content)) {
                // Handle structured content (text parts)
                content = msg.content
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('\n');
              }

              if (content) {
                messages.push({
                  role: msg.role as 'user' | 'assistant',
                  content,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.log('⚠️ Could not fetch conversation history:', err);
      // Continue without history - not a fatal error
    }

    // Add current user message
    messages.push({ role: 'user' as const, content: prompt });

    console.log(`💬 Built message array with ${messages.length} messages (${messages.length - 1} from history)`);

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

      // Generate default IDs if not provided or empty strings
      // This ensures conversation memory always works
      // Use stable defaults so the same thread persists across messages
      const effectiveResourceId = resourceId && resourceId.trim() !== ''
        ? resourceId
        : 'default-user';
      const effectiveThreadId = threadId && threadId.trim() !== ''
        ? threadId
        : 'default-thread';

      console.log('🤖 Starting agent.stream() with maxSteps: 5');
      console.log(`🧠 Memory enabled: resourceId=${effectiveResourceId}, threadId=${effectiveThreadId}`);
      console.log('📝 Messages being sent to agent:', JSON.stringify(messages.map(m => ({ role: m.role, contentLength: m.content.length, contentPreview: m.content.substring(0, 200) })), null, 2));

      // Ensure thread exists before streaming (Mastra requires thread to exist)
      try {
        const memory = await agent.getMemory();
        if (memory) {
          const existingThread = await memory.getThreadById({ threadId: effectiveThreadId });
          if (!existingThread) {
            console.log(`📝 Creating new thread: ${effectiveThreadId}`);
            await memory.createThread({
              threadId: effectiveThreadId,
              resourceId: effectiveResourceId,
              title: 'Security Chat',
            });
          }
        }
      } catch (memErr) {
        console.log('⚠️ Could not check/create thread (continuing anyway):', memErr);
      }

      let streamResult;
      try {
        streamResult = await agent.stream(messages, {
          ...(systemPrompt ? ({ instructions: systemPrompt } as const) : {}),
          temperature,
          maxTokens,
          maxSteps: 5, // Allow agent to call workflow (step 1) AND generate text response (step 2+)
          memory: { resource: effectiveResourceId, thread: effectiveThreadId },
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
      } catch (streamError) {
        console.error('❌ agent.stream() FAILED:', streamError);
        throw streamError;
      }

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
