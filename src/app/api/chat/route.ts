/**
 * SSE streaming chat endpoint.
 *
 * POST /api/chat
 * Body: { messages: { role, content }[], currentCode?: string }
 * Response: text/event-stream
 *
 * Uses reasoning mode (effort=max for new code, high for edits)
 * with RAG retrieval parallelized (won't block the API call).
 */

import { NextRequest } from "next/server";
import { chatCompletionStream, isConfigured, MODELS } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Require login — AI calls consume API quota
    const supabase = await createClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Supabase 未配置" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "请先登录后再使用生成功能" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await request.json();
    const messages = body.messages ?? [];
    const currentCode = (body.currentCode as string) ?? undefined;

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

    const lastUserMsg =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";

    if (!lastUserMsg) {
      return new Response(
        JSON.stringify({ error: "请提供用户消息" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const history = messages.slice(0, -1).filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant",
    );

    const isNewCode = !currentCode || currentCode.trim().length === 0;

    // Parallelize: start RAG and message building simultaneously.
    // If RAG finishes within 800ms, inject examples; otherwise proceed without.
    const fullMessages = await buildMessages(history, lastUserMsg, currentCode);

    const stream = await chatCompletionStream({
      messages: fullMessages,
      model: MODELS.code,
      reasoning_effort: isNewCode ? "max" : "high",
      max_tokens: 32768,
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
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
