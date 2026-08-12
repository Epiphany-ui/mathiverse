import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "无权限" },
      { status: 401 },
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const [profiles, vizs, articles, wikis, comments] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("visualizations").select("*", { count: "exact", head: true }),
    admin.from("articles").select("*", { count: "exact", head: true }),
    admin.from("wiki_entries").select("*", { count: "exact", head: true }),
    admin.from("comments").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    users: profiles.count ?? 0,
    visualizations: vizs.count ?? 0,
    articles: articles.count ?? 0,
    wikiEntries: wikis.count ?? 0,
    comments: comments.count ?? 0,
  });
}
