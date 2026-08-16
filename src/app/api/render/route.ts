/**
 * Local renderer proxy endpoint.
 *
 * POST /api/render
 * Body: { code: string, quality?: string, format?: string }
 *
 * Proxies to the local Python FastAPI renderer at NEXT_PUBLIC_RENDERER_URL.
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createRendererClient,
  RendererError,
} from "@/lib/generation/renderer-client";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RENDERER_URL =
  process.env.NEXT_PUBLIC_RENDERER_URL ?? "http://localhost:9876";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    // Require login — rendering consumes the renderer service
    const supabase = await createClient();
    if (!supabase) {
      return jsonResponse({ error: "Supabase 未配置" }, 503);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "请先登录后再渲染动画" }, 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "无效的 JSON" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "无效的请求体" }, 400);
    }
    const { code, quality = "-ql", format = "mp4" } = body as {
      code?: unknown;
      quality?: unknown;
      format?: unknown;
    };

    if (!code || typeof code !== "string") {
      return jsonResponse(
        { error: "请提供 Manim Python 代码" },
        400,
      );
    }

    if (!["-ql", "-qm", "-qh"].includes(String(quality))) {
      return jsonResponse({ error: "不支持的渲染质量" }, 400);
    }
    if (format !== "mp4" && format !== "gif") {
      return jsonResponse({ error: "不支持的输出格式" }, 400);
    }

    const artifact = await createRendererClient().renderManim({
      code,
      quality: quality as "-ql" | "-qm" | "-qh",
      format,
      requestId: randomUUID(),
      signal: request.signal,
    });
    return jsonResponse({
      success: true,
      video_url: artifact.format === "mp4" ? artifact.url : null,
      gif_url: artifact.format === "gif" ? artifact.url : null,
      duration: artifact.duration,
    });
  } catch (error) {
    if (error instanceof RendererError) {
      return jsonResponse(
        { error: error.message, diagnostics: error.issues },
        error.status >= 400 && error.status < 600 ? error.status : 503,
      );
    }
    return jsonResponse(
      {
        error:
          "本地渲染器未启动。请确保 Tauri 渲染器正在运行 (localhost:9876)。",
      },
      503,
    );
  }
}

/**
 * GET /api/render — health check (boolean only: no renderer details leak).
 */
export async function GET() {
  try {
    const res = await fetch(`${RENDERER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return jsonResponse({ connected: true });
    }
  } catch {
    // renderer not reachable
  }
  return jsonResponse({ connected: false });
}
