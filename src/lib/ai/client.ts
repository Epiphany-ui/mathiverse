/**
 * DeepSeek API client (OpenAI-compatible).
 *
 * Uses the OpenAI-compatible chat completions endpoint.
 * DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL must be set in .env.local.
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const MODELS = {
  /** Primary model for Manim code generation — stronger reasoning */
  code: "deepseek-v4-pro",
  /** Lighter model for metadata generation */
  metadata: "deepseek-v4-flash",
} as const;

export interface ChatCompletionRequest {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  /** Enable/disable internal reasoning. Default: enabled on v4 models. */
  thinking?: { type: "enabled" | "disabled" };
  /** Reasoning depth — only meaningful when thinking is enabled. */
  reasoning_effort?: "low" | "high" | "max";
  signal?: AbortSignal;
}

export interface ChatCompletionChunk {
  id: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }[];
}

const API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const BASE_URL =
  process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

/** Combine signals without AbortSignal.any (not yet in every TS lib target). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true },
    );
  }
  return controller.signal;
}

function buildRequestBody(
  request: ChatCompletionRequest,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model ?? MODELS.code,
    messages: request.messages,
    stream,
    max_tokens: request.max_tokens ?? 8192,
  };

  // Only include temperature when thinking is disabled (it's ignored otherwise)
  if (request.thinking?.type === "disabled") {
    body.temperature = request.temperature ?? 0.4;
  }

  // Thinking / reasoning control
  if (request.thinking) {
    body.thinking = request.thinking;
  }
  if (request.reasoning_effort) {
    body.reasoning_effort = request.reasoning_effort;
  }

  return body;
}

export function isConfigured(): boolean {
  return (
    API_KEY.length > 0 &&
    API_KEY !== "your_deepseek_api_key" &&
    BASE_URL.length > 0
  );
}

/**
 * Non-streaming chat completion. Returns the full response text.
 *
 * Callers may pass their own AbortSignal (job cancel / user abort); when none
 * is given a default deadline prevents a hung upstream from blocking forever.
 */
export async function chatCompletion(
  request: ChatCompletionRequest,
): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      "DeepSeek API 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY",
    );
  }

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(buildRequestBody(request, false)),
    signal: request.signal ?? AbortSignal.timeout(5 * 60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Streaming chat completion. Returns a ReadableStream of SSE chunks.
 * Use this from an API route to proxy to the client via SSE.
 */
export async function chatCompletionStream(
  request: ChatCompletionRequest,
): Promise<ReadableStream<Uint8Array>> {
  if (!isConfigured()) {
    throw new Error(
      "DeepSeek API 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY",
    );
  }

  // The upstream fetch is aborted either by the caller's signal (client
  // disconnect / job cancel), by our own controller when the downstream
  // consumer cancels the returned stream, or by the default deadline.
  const upstream = new AbortController();
  const signals: AbortSignal[] = [upstream.signal];
  if (request.signal) signals.push(request.signal);
  else signals.push(AbortSignal.timeout(15 * 60_000));
  const signal = anySignal(signals);

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(buildRequestBody(request, true)),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  if (!res.body) {
    throw new Error("DeepSeek API 返回了空响应体");
  }

  // Transform the DeepSeek SSE stream into a clean text stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed: ChatCompletionChunk = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              // Skip reasoning_content — only forward final content to client
              const content = delta?.content;
              if (content) {
                // Send as SSE to the client
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
                );
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
        controller.close();
      } catch (e) {
        // An abort (client disconnect, cancel, deadline) is a normal end of
        // stream, not a server error.
        if (signal.aborted) {
          controller.close();
        } else {
          controller.error(e);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Reader may already be released by the abort path.
        }
      }
    },
    cancel() {
      upstream.abort();
    },
  });
}
