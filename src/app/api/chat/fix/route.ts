// src/app/api/chat/fix/route.ts
// AI error fixing — V2 returns incremental diffs; V1 full-code fallback.
// Simple errors → no thinking (fast); complex → reasoning enabled (thorough).

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, isConfigured, MODELS } from "@/lib/ai/client";
import {
  buildFixPrompt,
  buildFixPromptV2,
  parseFixResponse,
  extractCode,
} from "@/lib/ai/prompts";

export const runtime = "nodejs";

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

    // ── Try V2 incremental fix first ──
    const v2Prompt = buildFixPromptV2(code, renderError);

    try {
      const v2Response = await chatCompletion({
        messages: [{ role: "user", content: v2Prompt }],
        model: isSimple ? MODELS.metadata : MODELS.code,
        thinking: isSimple ? { type: "disabled" } : undefined,
        reasoning_effort: isSimple ? undefined : "low",
        temperature: isSimple ? 0.1 : undefined,
        max_tokens: isSimple ? 2048 : 4096,
      });

      const parsed = parseFixResponse(v2Response);
      if (parsed?.changes?.length) {
        return NextResponse.json({ changes: parsed.changes, mode: "diff" });
      }
    } catch {
      // V2 failed — fall through to V1
    }

    // ── V1 fallback: full-code fix ──
    const v1Prompt = buildFixPrompt(code, renderError);
    const v1Response = await chatCompletion({
      messages: [{ role: "user", content: v1Prompt }],
      model: isSimple ? MODELS.metadata : MODELS.code,
      thinking: isSimple ? { type: "disabled" } : undefined,
      reasoning_effort: isSimple ? undefined : "low",
      temperature: isSimple ? 0.1 : undefined,
      max_tokens: isSimple ? 4096 : 8192,
    });

    const fixedCode = extractCode(v1Response);
    return NextResponse.json({ code: fixedCode || v1Response, mode: "full" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}
