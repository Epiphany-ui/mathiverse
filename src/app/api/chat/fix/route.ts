// src/app/api/chat/fix/route.ts
// Non-streaming endpoint for AI error fixing

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, isConfigured, MODELS } from "@/lib/ai/client";
import { buildFixPrompt, extractCode } from "@/lib/ai/prompts";

export const runtime = "nodejs";

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

    const prompt = buildFixPrompt(code, renderError);

    const response = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      model: MODELS.code,
      temperature: 0.2,
      max_tokens: 8192,
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
