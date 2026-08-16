/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { await requireAdmin(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "无权限" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "visualizations";
  if (!["visualizations", "articles", "wiki_entries", "comments"].includes(type)) {
    return NextResponse.json({ error: "不支持的类型" }, { status: 400 });
  }

  const isComment = type === "comments";
  const { data, error } = await (admin as any)
    .from(type)
    .select(isComment ? "id, body, author_id, created_at" : "id, title, author_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "内容列表加载失败" }, { status: 500 });

  const authorIds = [...new Set((data ?? []).map((d: any) => d.author_id).filter(Boolean))];
  const authorMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await (admin as any).from("profiles").select("id, username").in("id", authorIds);
    for (const p of (profiles ?? [])) authorMap.set(p.id, `@${p.username}`);
  }

  const items = (data ?? []).map((d: any) => ({
    id: d.id,
    title: isComment ? String(d.body ?? "").slice(0, 60) : d.title,
    author: authorMap.get(d.author_id) ?? "—",
    created_at: d.created_at,
  }));
  return NextResponse.json({ items });
}
