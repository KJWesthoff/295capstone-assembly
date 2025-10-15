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

    // Extract scan ID from additionalContext if present
    if (inputData.additionalContext) {
      console.log('Additional context received:', JSON.stringify(inputData.additionalContext, null, 2));

      // Look for scan ID in additionalContext
      let scanId: string | null = null;

      // Check scanResults state subscription (from useSecurityContext)
      if (inputData.additionalContext.scanResults) {
        const scanResults = Array.isArray(inputData.additionalContext.scanResults)
          ? inputData.additionalContext.scanResults[0]
          : inputData.additionalContext.scanResults;

        if (scanResults?.data?.scanId) {
          scanId = scanResults.data.scanId;
          console.log(`Found scan ID in scanResults context: ${scanId}`);
        }
      }

      // Check manual context entries (from addContextEntry button)
      for (const key in inputData.additionalContext) {
        const entries = inputData.additionalContext[key];
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (entry.data?.scanId) {
              scanId = entry.data.scanId;
              console.log(`Found scan ID in manual context entry: ${scanId}`);
              break;
            }
          }
        }
        if (scanId) break;
      }

      // If scan ID found and user is asking for analysis, append it to prompt
      if (scanId && (
        inputData.prompt.toLowerCase().includes('analyz') ||
        inputData.prompt.toLowerCase().includes('report') ||
        inputData.prompt.toLowerCase().includes('scan')
      )) {
        enhancedPrompt = `${inputData.prompt}

[CONTEXT: Scan ID ${scanId} is available in the context. Use scan-analysis-workflow to analyze it.]`;
        console.log(`Enhanced prompt with scan ID: ${scanId}`);
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
        finalText = await handleTextStream(streamResult, streamController);
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

      // Try to send error to stream if still available
      if (streamController) {
        try {
          streamJSONEvent(streamController, {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } catch (streamError) {
          // Stream is closed, log and continue
          console.debug('Could not send error to stream (already closed)');
        }
      }

      // Re-throw the error for workflow error handling
      throw error;
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
  .then(emitMastraEvents)
  .then(callAgent)
  .commit();
