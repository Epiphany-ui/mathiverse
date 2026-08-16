/**
 * POST /api/profile/avatar — Upload avatar image to Supabase Storage.
 *
 * Accepts multipart/form-data with a single "file" field.
 * Validates: authenticated user, image MIME type, size ≤ 5 MB.
 * Returns: { url: string } — the public URL of the uploaded avatar.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient, ensureStorageBucket, uploadToStorage } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const AVATARS_BUCKET = "avatars";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Verify the declared MIME type against magic bytes so disguised files
 *  (HTML/SVG/scripts renamed to .png) never reach the public bucket. */
function sniffImageType(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 6 &&
    (buf.toString("ascii", 0, 6) === "GIF87a" ||
      buf.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 未配置" },
      { status: 503 },
    );
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { error: "请先登录" },
      { status: 401 },
    );
  }

  // Parse form data
  let file: File;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (!entry || !(entry instanceof File)) {
      return NextResponse.json(
        { error: "请提供图片文件" },
        { status: 400 },
      );
    }
    file = entry;
  } catch {
    return NextResponse.json(
      { error: "请求格式错误，需要 multipart/form-data" },
      { status: 400 },
    );
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "仅支持 PNG、JPEG、WebP、GIF 格式" },
      { status: 400 },
    );
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "图片大小不能超过 5 MB" },
      { status: 400 },
    );
  }

  try {
    // Ensure Storage bucket exists
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Storage 服务不可用" },
        { status: 503 },
      );
    }

    await ensureStorageBucket(AVATARS_BUCKET, {
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: MAX_SIZE,
    });

    // Upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffedType = sniffImageType(buffer);
    if (!sniffedType || sniffedType !== file.type) {
      return NextResponse.json(
        { error: "文件内容与声明的图片格式不符" },
        { status: 400 },
      );
    }
    // Derive the extension from the verified type, never from the client's
    // file name (which may contain separators or misleading extensions).
    const ext = EXT_BY_TYPE[sniffedType] ?? "png";
    const filePath = `${user.id}-${Date.now()}.${ext}`;

    const publicUrl = await uploadToStorage(AVATARS_BUCKET, filePath, buffer, sniffedType);
    if (!publicUrl) {
      return NextResponse.json(
        { error: "上传失败，请重试" },
        { status: 500 },
      );
    }

    // Update profile
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) {
      // Avatar file uploaded but profile update failed — still return the URL
      console.error("Failed to update profile avatar_url:", updateErr.message);
    }

    // Sync auth metadata for header avatar display
    try {
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 },
    );
  }
}
