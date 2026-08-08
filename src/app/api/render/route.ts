/**
 * Local renderer proxy endpoint.
 *
 * POST /api/render
 * Body: { code: string, quality?: string, format?: string }
 *
 * Proxies to the local Python FastAPI renderer at NEXT_PUBLIC_RENDERER_URL.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RENDERER_URL =
  process.env.NEXT_PUBLIC_RENDERER_URL ?? "http://localhost:9876";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, quality = "-ql", format = "mp4" } = body;

    if (!code || typeof code !== "string") {
      return jsonResponse(
        { error: "请提供 Manim Python 代码" },
        400,
      );
    }

    const res = await fetch(`${RENDERER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, quality, format }),
    });

    if (!res.ok) {
      const err = await res.text();
      return jsonResponse(
        { error: `渲染失败: ${err}` },
        502,
      );
    }

    const data = await res.json();
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse(
      {
        error:
          "本地渲染器未启动。请确保 Tauri 渲染器正在运行 (localhost:9876)。",
        details: error instanceof Error ? error.message : "连接失败",
      },
      503,
    );
  }
}

/**
 * GET /api/render — health check
 */
export async function GET() {
  try {
    const res = await fetch(`${RENDERER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return jsonResponse({ connected: true, ...data });
    }
  } catch {
    // renderer not reachable
  }
  return jsonResponse({ connected: false });
}
