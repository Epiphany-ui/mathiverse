/**
 * POST /api/admin/wiki/ingest
 *
 * Admin-only endpoint to trigger Wikipedia ingestion.
 * Requires x-admin-token header matching WIKI_ADMIN_TOKEN env var.
 *
 * Body: { slug?: string, dryRun?: boolean }
 * Returns: { results: IngestResult[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ingestEntry, ingestAll } from "@/lib/wiki/ingest";
import { WIKI_MANIFEST } from "@/lib/wiki/manifest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Admin gate — constant-time token comparison.
  const token = request.headers.get("x-admin-token");
  const expected = process.env.WIKI_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "WIKI_ADMIN_TOKEN 未配置" },
      { status: 503 },
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "无权限" },
      { status: 401 },
    );
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: "无权限" },
      { status: 401 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
    }
    const { slug, dryRun } = body as { slug?: unknown; dryRun?: unknown };
    // Only accept a real boolean — string "false" must never trigger a dry-run.
    const isDryRun = dryRun === true;

    if (typeof slug === "string" && slug.trim()) {
      const item = WIKI_MANIFEST.find((i) => i.slug === slug.trim());
      if (!item) {
        return NextResponse.json(
          { error: `词条不在 manifest 中: ${slug}` },
          { status: 400 },
        );
      }
      const result = await ingestEntry(item, isDryRun);
      return NextResponse.json({ results: [result] }, { status: 201 });
    }

    const results = await ingestAll(isDryRun);
    return NextResponse.json({ results }, { status: 201 });
  } catch (err) {
    console.error("[wiki-ingest] API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 },
    );
  }
}
