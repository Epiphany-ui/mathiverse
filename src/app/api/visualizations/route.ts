/**
 * POST /api/visualizations — Create a new visualization and publish it.
 *
 * Requires authentication (Supabase session).
 * Body: { title, description, tags, sourceCode, videoUrl?, posterUrl? }
 * Returns: { id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase 未配置" },
        { status: 503 },
      );
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再发布" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      title,
      description = "",
      tags = [],
      sourceCode,
      videoUrl = null,
      posterUrl = null,
    } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "请输入标题" },
        { status: 400 },
      );
    }

    if (!sourceCode || typeof sourceCode !== "string" || !sourceCode.trim()) {
      return NextResponse.json(
        { error: "代码不能为空" },
        { status: 400 },
      );
    }

    // Ensure tags is an array of strings
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t: any) => typeof t === "string" && t.trim())
      : [];

    const { data, error } = await supabase
      .from("visualizations")
      .insert({
        title: title.trim(),
        description: (description ?? "").trim(),
        tags: cleanTags,
        source_code: sourceCode,
        video_url: videoUrl,
        poster_url: posterUrl,
        author_id: user.id,
        is_published: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create visualization:", error);
      return NextResponse.json(
        { error: "创建失败，请重试" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Visualization API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 },
    );
  }
}
