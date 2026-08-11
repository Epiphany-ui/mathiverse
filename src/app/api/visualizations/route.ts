/**
 * POST /api/visualizations — Create a new visualization and publish it.
 *
 * Requires authentication (Supabase session).
 * Body: { title, description, tags, sourceCode, videoUrl?, posterUrl? }
 * Returns: { id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureStorageBucket,
  uploadVideoToStorage,
} from "@/lib/supabase/admin";
import { isLocalRendererUrl } from "@/lib/utils";
import { tryAutoIndex } from "@/lib/ai/retrieval";

export const runtime = "nodejs";

const STORAGE_BUCKET = "renders";

/**
 * Fetch the video from the local renderer and upload to Supabase Storage.
 * Returns the Supabase public URL, or null if the upload fails.
 */
async function persistVideo(url: string): Promise<string | null> {
  // Extract filename from renderer URL like http://127.0.0.1:9876/output/abc_Scene.mp4
  const filename = url.split("/").pop();
  if (!filename) return null;

  try {
    // Fetch video from local renderer
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`[visualizations] Failed to fetch video from renderer: ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = filename.endsWith(".gif")
      ? "image/gif"
      : "video/mp4";

    // Ensure bucket exists
    const bucketReady = await ensureStorageBucket(STORAGE_BUCKET);
    if (!bucketReady) return null;

    // Upload to Supabase Storage
    const publicUrl = await uploadVideoToStorage(
      STORAGE_BUCKET,
      filename,
      buffer,
      mimeType,
    );

    return publicUrl;
  } catch (err) {
    console.warn("[visualizations] Video persistence failed:", err);
    return null;
  }
}

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
      forkedFrom = null,
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
      ? tags.filter(
          (tag: unknown): tag is string =>
            typeof tag === "string" && tag.trim().length > 0,
        )
      : [];

    // If the video is from the local renderer, upload it to Supabase Storage
    // so it's persistently accessible (not tied to the renderer process).
    let videoPersisted = false;
    let persistedVideoUrl = videoUrl;
    if (typeof videoUrl === "string" && isLocalRendererUrl(videoUrl)) {
      const uploadResult = await persistVideo(videoUrl);
      if (uploadResult) {
        persistedVideoUrl = uploadResult;
        videoPersisted = true;
        console.log("[visualizations] Video persisted to Supabase Storage");
      } else {
        // Still publish — the video proxy will serve it in local dev.
        // In production, the user should re-render to trigger a new upload.
        console.warn(
          "[visualizations] Video persistence failed — check SUPABASE_SERVICE_ROLE_KEY and renderer connectivity. " +
            "The video will be served via proxy in local dev.",
        );
      }
    }

    const { data, error } = await supabase
      .from("visualizations")
      .insert({
        title: title.trim(),
        description: (description ?? "").trim(),
        tags: cleanTags,
        source_code: sourceCode,
        video_url: persistedVideoUrl,
        poster_url: posterUrl,
        author_id: user.id,
        forked_from: forkedFrom,
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

    // Auto-index into RAG examples — fire-and-forget, never blocks response
    if (sourceCode && typeof sourceCode === "string" && sourceCode.trim()) {
      tryAutoIndex({
        code: sourceCode,
        title: title.trim(),
        description: (description ?? "").trim(),
        tags: cleanTags,
      }).then((id) => {
        if (id) {
          console.log(`[visualizations] Auto-indexed example ${id}`);
        }
      });
    }

    return NextResponse.json(
      { id: data.id, videoPersisted },
      { status: 201 },
    );
  } catch (err) {
    console.error("Visualization API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 },
    );
  }
}
