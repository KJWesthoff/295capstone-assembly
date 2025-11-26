import { StreamTextResult } from 'ai';

// ------------------- Functions for Data-Only SSE Format -------------------

/**
 * Uses SSE data-only format.
 * Only uses 'event: done' with empty data for completion.
 * All other content goes through 'data:' field only.
 */
export function createSSEStream(
  cb: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await cb(controller);
        // Signal completion with empty data
        controller.enqueue(encoder.encode('event: done\n'));
        controller.enqueue(encoder.encode('data:\n\n'));
      } catch (err) {
        console.error('Error during SSE stream', err);

        const message = err instanceof Error ? err.message : 'Internal error';
        controller.enqueue(encoder.encode('data: '));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Emit any JSON object as a data event.
 * Used for actions, tool responses, custom events, etc.
 */
export function streamJSONEvent<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  eventData: T,
) {
  try {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode('data: '));
    controller.enqueue(encoder.encode(`${JSON.stringify(eventData)}\n\n`));
  } catch (error) {
    // Silently ignore errors if the stream is already closed
    if (error instanceof TypeError && error.message.includes('Controller is already closed')) {
      console.debug('Stream already closed, skipping event emission');
    } else {
      throw error;
    }
  }
}

/**
 * Handles streaming of text chunks using data-only format.
 * Sends text as plain content for Cedar OS to parse as message chunks.
 */
export async function handleTextStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streamResult: StreamTextResult<any, any>,
  streamController: ReadableStreamDefaultController<Uint8Array>,
): Promise<string> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];

  try {
    // Stream text chunks as plain text content for Cedar OS
    // Cedar expects raw text in SSE data field for message streaming
    for await (const chunk of streamResult.textStream) {
      chunks.push(chunk);
      // Send text chunk directly - Cedar parses plain text as message content
      streamController.enqueue(encoder.encode(`data: ${chunk}\n\n`));
    }
  } catch (error) {
    // Handle stream errors gracefully
    if (error instanceof TypeError && error.message.includes('Controller is already closed')) {
      console.debug('Stream already closed during text streaming');
    } else {
      console.error('Error during text streaming:', error);
      throw error;
    }
  }

  return chunks.join('');
}
