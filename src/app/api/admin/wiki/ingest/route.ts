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
import { ingestEntry, ingestAll } from "@/lib/wiki/ingest";
import { WIKI_MANIFEST } from "@/lib/wiki/manifest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Admin gate
  const token = request.headers.get("x-admin-token");
  const expected = process.env.WIKI_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "WIKI_ADMIN_TOKEN 未配置" },
      { status: 503 },
    );
  }
  if (!token || token !== expected) {
    return NextResponse.json(
      { error: "无权限" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { slug, dryRun = false } = body;

    if (typeof slug === "string" && slug.trim()) {
      const item = WIKI_MANIFEST.find((i) => i.slug === slug.trim());
      if (!item) {
        return NextResponse.json(
          { error: `词条不在 manifest 中: ${slug}` },
          { status: 400 },
        );
      }
      const result = await ingestEntry(item, Boolean(dryRun));
      return NextResponse.json({ results: [result] }, { status: 201 });
    }

    const results = await ingestAll(Boolean(dryRun));
    return NextResponse.json({ results }, { status: 201 });
  } catch (err) {
    console.error("[wiki-ingest] API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 },
    );
  }
}
