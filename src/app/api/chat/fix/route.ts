// src/app/api/chat/fix/route.ts
// Non-streaming endpoint for AI error fixing.
// Uses severity-based thinking: simple errors → no thinking (fast),
// complex rendering/logic errors → reasoning enabled (thorough).

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, isConfigured, MODELS } from "@/lib/ai/client";
import { buildFixPrompt, extractCode } from "@/lib/ai/prompts";

export const runtime = "nodejs";

/** Simple syntax/name errors that don't need reasoning to fix. */
const SIMPLE_ERRORS = /NameError|SyntaxError|IndentationError|AttributeError/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, error: renderError } = body;

    if (!isConfigured()) {
      return NextResponse.json(
        { error: "DeepSeek API 未配置" },
        { status: 503 },
      );
    }

    if (!code || !renderError) {
      return NextResponse.json(
        { error: "请提供代码和错误信息" },
        { status: 400 },
      );
    }

    const isSimple = SIMPLE_ERRORS.test(renderError);

    const prompt = buildFixPrompt(code, renderError);

    const response = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      model: isSimple ? MODELS.metadata : MODELS.code,
      thinking: isSimple ? { type: "disabled" } : undefined,
      reasoning_effort: isSimple ? undefined : "low",
      temperature: isSimple ? 0.1 : undefined,
      max_tokens: isSimple ? 4096 : 8192,
    });

    const fixedCode = extractCode(response);
    return NextResponse.json({ code: fixedCode || response });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}
