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

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  const parsed = body as Record<string, unknown>;

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const bodyMd = typeof parsed.bodyMd === "string" ? parsed.bodyMd : "";
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 20)
    : [];

  if (!title || title.length < 2) {
    return NextResponse.json({ error: "标题至少需要 2 个字符" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "标题不能超过 200 个字符" }, { status: 400 });
  }
  if (!bodyMd) {
    return NextResponse.json({ error: "正文不能为空" }, { status: 400 });
  }
  if (bodyMd.length > 200_000) {
    return NextResponse.json({ error: "正文过长" }, { status: 400 });
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
    console.error("Failed to create article:", error.message);
    return NextResponse.json({ error: "创建失败，请重试" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
