// SSE serialization helpers for generation events.

import type { GenerationEvent } from "./types";

/**
 * Serialize a GenerationEvent as an SSE message string.
 * Format: id, event, data (JSON), blank line.
 */
export function serializeSseEvent(event: GenerationEvent): string {
  const lines: string[] = [];
  lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push("", ""); // blank line terminates the message
  return lines.join("\n");
}

/**
 * Serialize an SSE heartbeat comment (not a GenerationEvent).
 */
export function serializeHeartbeat(): string {
  return ": heartbeat\n\n";
}

/**
 * Create SSE headers for a streaming response.
 */
export function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * Parse the cursor from a request: first checks Last-Event-ID header,
 * then falls back to the `after` query parameter.
 */
export function parseEventCursor(
  request: Request,
): number {
  const lastEventId = request.headers.get("Last-Event-ID");
  if (lastEventId) {
    const parsed = Number(lastEventId);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  if (after) {
    const parsed = Number(after);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

/**
 * SSE stream that polls for new events, sends heartbeats when idle.
 */
export async function* sseEventStream(
  poll: () => Promise<GenerationEvent[]>,
  heartbeatMs: number,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  while (!signal.aborted) {
    let emitted = false;
    try {
      const events = await poll();
      for (const event of events) {
        yield serializeSseEvent(event);
        emitted = true;
      }
    } catch {
      if (signal.aborted) return;
      // On poll error, yield a retry comment
      yield ": retry\n\n";
    }

    if (!emitted) {
      yield serializeHeartbeat();
    }

    // Wait for next poll
    try {
      await new Promise<void>((resolve, reject) => {
        const id = setTimeout(resolve, heartbeatMs);
        const onAbort = () => {
          clearTimeout(id);
          reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
      });
    } catch {
      return; // aborted
    }
  }
}
