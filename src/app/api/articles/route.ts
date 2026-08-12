// POST /api/articles — publish an article (server-side validated)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const bodyMd = typeof body.bodyMd === "string" ? body.bodyMd : "";
  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string") : [];

  if (!title || title.length < 2) {
    return NextResponse.json({ error: "标题至少需要 2 个字符" }, { status: 400 });
  }
  if (!bodyMd) {
    return NextResponse.json({ error: "正文不能为空" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title,
      body_md: bodyMd,
      author_id: user.id,
      tags,
      is_published: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
