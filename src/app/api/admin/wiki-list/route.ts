/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { await requireAdmin(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "无权限" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });

  const { data, error } = await (admin as any)
    .from("wiki_entries")
    .select("id, slug, title, category, is_published, author_id, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "词条列表加载失败" }, { status: 500 });

  // Batch-fetch authors
  const authorIds = [...new Set((data ?? []).map((d: any) => d.author_id).filter(Boolean))];
  const authorMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await (admin as any).from("profiles").select("id, username").in("id", authorIds);
    for (const p of (profiles ?? [])) authorMap.set(p.id, `@${p.username}`);
  }

  const entries = (data ?? []).map((d: any) => ({
    id: d.id, slug: d.slug, title: d.title, category: d.category,
    is_published: d.is_published,
    author: authorMap.get(d.author_id) ?? "—",
    updated_at: d.updated_at,
  }));

  return NextResponse.json({ entries });
}
