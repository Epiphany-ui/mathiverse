/**
 * SSE streaming chat endpoint.
 *
 * POST /api/chat
 * Body: { messages: { role, content }[] }
 * Response: text/event-stream
 *
 * Proxies to DeepSeek API with Manim-specific prompt templates.
 */

import { NextRequest } from "next/server";
import { chatCompletionStream, isConfigured } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = body.messages ?? [];

    if (!isConfigured()) {
      return new Response(
        JSON.stringify({
          error: "DeepSeek API 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get the last user message for prompt building
    const lastUserMsg =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";

    if (!lastUserMsg) {
      return new Response(
        JSON.stringify({ error: "请提供用户消息" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Build conversation with system prompt + few-shot examples
    const history = messages.slice(0, -1); // all except last
    const fullMessages = buildMessages(
      history.filter(
        (m: { role: string }) => m.role === "user" || m.role === "assistant",
      ),
      lastUserMsg,
    );

    const stream = await chatCompletionStream({
      messages: fullMessages,
      temperature: 0.3,
      max_tokens: 4096,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "未知错误",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
