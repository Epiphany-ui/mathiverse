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
  uploadToStorage,
} from "@/lib/supabase/admin";
import { isLocalRendererUrl } from "@/lib/utils";

export const runtime = "nodejs";

const STORAGE_BUCKET = "renders";
/** Renderer clips are short; reject anything implausibly large to protect
 *  the server's memory from abuse. */
const MAX_MEDIA_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Fetch a media file from the renderer and upload to Supabase Storage.
 * Returns the Supabase public URL, or null if the upload fails.
 */
async function persistMedia(url: string): Promise<string | null> {
  // Extract filename from renderer URL like http://127.0.0.1:9876/output/abc_Scene.mp4
  const rawName = url.split("/").pop() ?? "";
  const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!filename) return null;

  try {
    // Fetch media from the renderer
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`[visualizations] Failed to fetch media from renderer: ${res.status}`);
      return null;
    }

    const contentLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
      console.warn("[visualizations] Media too large to persist:", contentLength);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) {
      console.warn("[visualizations] Media exceeded size cap after download");
      return null;
    }

    const mimeType = filename.endsWith(".gif")
      ? "image/gif"
      : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
        ? "image/jpeg"
        : "video/mp4";

    // Ensure bucket exists
    const bucketReady = await ensureStorageBucket(STORAGE_BUCKET);
    if (!bucketReady) return null;

    // Upload to Supabase Storage
    const publicUrl = await uploadToStorage(
      STORAGE_BUCKET,
      filename,
      buffer,
      mimeType,
    );

    return publicUrl;
  } catch (err) {
    console.warn("[visualizations] Media persistence failed:", err);
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
    }
    const parsed = body as Record<string, unknown>;
    const {
      title,
      description = "",
      tags = [],
      sourceCode,
      videoUrl = null,
      posterUrl = null,
      forkedFrom = null,
    } = parsed;

    // Validate required fields
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "请输入标题" },
        { status: 400 },
      );
    }
    if (title.length > 200) {
      return NextResponse.json(
        { error: "标题不能超过 200 个字符" },
        { status: 400 },
      );
    }

    if (!sourceCode || typeof sourceCode !== "string" || !sourceCode.trim()) {
      return NextResponse.json(
        { error: "代码不能为空" },
        { status: 400 },
      );
    }
    if (sourceCode.length > 200_000) {
      return NextResponse.json(
        { error: "代码过长" },
        { status: 400 },
      );
    }

    // Ensure tags is an array of strings (bounded)
    const cleanTags = Array.isArray(tags)
      ? tags
          .filter(
            (tag: unknown): tag is string =>
              typeof tag === "string" && tag.trim().length > 0,
          )
          .slice(0, 20)
      : [];

    // If the video is from the renderer, upload it to Supabase Storage
    // so it's persistently accessible (not tied to the renderer process).
    let videoPersisted = false;
    let persistedVideoUrl = videoUrl;
    if (typeof videoUrl === "string" && isLocalRendererUrl(videoUrl)) {
      const uploadResult = await persistMedia(videoUrl);
      if (uploadResult) {
        persistedVideoUrl = uploadResult;
        videoPersisted = true;
        console.log("[visualizations] Video persisted to Supabase Storage");
      } else {
        // Renderer URL won't work in production.  Drop the video so
        // the published viz shows as code-only rather than a broken player.
        persistedVideoUrl = null;
        console.warn(
          "[visualizations] Video persistence failed — published without video. " +
            "Check SUPABASE_SERVICE_ROLE_KEY and renderer connectivity.",
        );
      }
    }

    // Persist the poster image too (renderer-generated frame at ~1s).
    let persistedPosterUrl = posterUrl;
    if (typeof posterUrl === "string" && isLocalRendererUrl(posterUrl)) {
      const posterResult = await persistMedia(posterUrl);
      if (posterResult) {
        persistedPosterUrl = posterResult;
        console.log("[visualizations] Poster persisted to Supabase Storage");
      } else {
        persistedPosterUrl = null;
      }
    }

    const { data, error } = await supabase
      .from("visualizations")
      .insert({
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : "",
        tags: cleanTags,
        source_code: sourceCode,
        video_url: persistedVideoUrl,
        poster_url: persistedPosterUrl,
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

    // Fire-and-forget RAG indexing — non-blocking, degrades gracefully
    import("@/lib/ai/retrieval").then(({ tryAutoIndex }) =>
      tryAutoIndex({
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : "",
        code: sourceCode,
        tags: cleanTags,
      }).catch(() => {}),
    );

    return NextResponse.json(
      { id: data.id, videoPersisted },
      { status: 201 },
    );
  } catch (err) {
    console.error("Visualization API error:", err);
    return NextResponse.json(
      { error: "发布失败，请重试" },
      { status: 500 },
    );
  }
}
