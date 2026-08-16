/**
 * GET /api/video-proxy?url=<encoded-url>
 *
 * Proxies video content from the local renderer.
 * Only allows local renderer URLs (127.0.0.1:9876 / localhost:9876).
 * Streams the response so the browser can play it directly.
 *
 * This is a local-development convenience — in production, videos
 * should be uploaded to Supabase Storage during publish.
 */

import { NextRequest, NextResponse } from "next/server";
import { isLocalRendererUrl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CONNECT_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  // Require login — the proxy reads renderer output and must not be an
  // anonymous read gateway into the local renderer.
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
  }

  if (!isLocalRendererUrl(url)) {
    return NextResponse.json(
      { error: "仅支持本地渲染器 URL (localhost:9876)" },
      { status: 403 },
    );
  }

  // Only published renderer output is proxied — never staging files
  // (in-flight scene.py sources) or any other renderer endpoint.
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return NextResponse.json({ error: "无效的 URL" }, { status: 400 });
  }
  if (!pathname.startsWith("/output/") || pathname.includes("/.staging")) {
    return NextResponse.json(
      { error: "仅支持渲染器输出文件" },
      { status: 403 },
    );
  }

  try {
    // Only time out the connection phase — body streaming must complete unbound
    const connectController = new AbortController();
    const connectTimer = setTimeout(
      () => connectController.abort(),
      CONNECT_TIMEOUT_MS,
    );

    // Forward Range header for seeking / Safari support
    const rangeHeader = request.headers.get("range");
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    let res: Response;
    try {
      // Never follow redirects — a 30x Location could point anywhere and
      // would bypass the host whitelist above.
      res = await fetch(url, {
        headers: fetchHeaders,
        signal: connectController.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!res.ok && res.status !== 206) {
      // Forward the renderer's error response as-is so the browser's
      // <video> element fails fast rather than spinning forever on JSON.
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "text/plain",
        },
      });
    }

    // Forward response headers from renderer
    const contentType =
      res.headers.get("content-type") ?? "video/mp4";

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    };

    // Pass through Content-Range / Content-Length from renderer (especially for 206)
    const contentRange = res.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;
    if (contentRange) responseHeaders["Accept-Ranges"] = "bytes";

    const contentLength = res.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message =
      err instanceof DOMException && err.name === "AbortError"
        ? "连接渲染器超时"
        : "无法连接本地渲染器。请确保渲染器正在运行。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
