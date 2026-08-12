// POST /api/wiki — create a new wiki entry (user-submitted, pending review)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createWikiEntry } from "@/lib/db/wiki";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["pure-math", "applied-math", "cs-overlap"];

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const summary = typeof body.summary === "string" ? body.summary : "";
  const bodyMd = typeof body.bodyMd === "string" ? body.bodyMd : "";

  if (!title || !bodyMd) {
    return NextResponse.json({ error: "标题和正文不能为空" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `分类无效，可选: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const admin = getAdminClient();
  const client = admin ?? supabase;

  try {
    const entry = await createWikiEntry(client, {
      slug: finalSlug,
      title,
      category,
      summary,
      bodyMd,
      authorId: user.id,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate")) {
      return NextResponse.json(
        { error: "该 slug 已被使用，请修改标题或手动设置 slug" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}
