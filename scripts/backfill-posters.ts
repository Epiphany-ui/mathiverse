#!/usr/bin/env npx tsx
/**
 * Backfill poster_url for existing visualizations that have a video but no poster.
 * Downloads each video from Supabase Storage, extracts a frame at ~1s with
 * ffmpeg (resolved from PATH or the local manim venv), uploads the JPEG back
 * to the "renders" bucket, and updates poster_url in the DB.
 *
 * Usage: npx tsx scripts/backfill-posters.ts [--limit N]
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* ok */ }
}
loadEnvLocal();

const STORAGE_BUCKET = "renders";

function findFfmpeg(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    "/tmp/manim-venv/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "ffmpeg",
  ].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["-version"], { stdio: "ignore", timeout: 5000 });
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error("ffmpeg not found — install it or set FFMPEG_PATH");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[backfill] Missing Supabase env vars");
    process.exit(1);
  }

  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ffmpeg = findFfmpeg();
  console.log(`[backfill] Using ffmpeg: ${ffmpeg}`);

  // Ensure the bucket accepts poster images (older buckets may not)
  const { error: bucketUpdateErr } = await admin.storage.updateBucket(
    STORAGE_BUCKET,
    {
      public: true,
      allowedMimeTypes: [
        "video/mp4",
        "video/webm",
        "image/gif",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ],
    },
  );
  if (bucketUpdateErr) {
    console.warn("[backfill] Bucket mime update failed (continuing anyway):", bucketUpdateErr.message);
  } else {
    console.log("[backfill] Bucket mime types updated");
  }

  let query = admin
    .from("visualizations")
    .select("id, video_url")
    .is("poster_url", null)
    .not("video_url", "is", null);
  if (limit > 0) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[backfill] Query failed:", error);
    process.exit(1);
  }

  const items = (rows ?? []).filter((r) => typeof r.video_url === "string" && r.video_url.length > 0);
  console.log(`[backfill] Found ${items.length} visualizations without posters`);

  let ok = 0;
  let failed = 0;

  for (const item of items) {
    const id = item.id as string;
    const videoUrl = item.video_url as string;
    const slug = videoUrl.split("/").pop() ?? `${id}.mp4`;
    const posterName = slug.replace(/\.(mp4|gif)$/i, "") + ".poster.jpg";

    const tmpDir = "/tmp/mathiverse-backfill";
    const videoPath = `${tmpDir}/${id}.mp4`;
    const posterPath = `${tmpDir}/${posterName}`;
    try {
      execFileSync("mkdir", ["-p", tmpDir]);

      // 1. Download the video
      console.log(`[backfill] ${id}: downloading ${videoUrl}`);
      const res = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok || !res.body) {
        console.warn(`[backfill] ${id}: download failed (${res.status})`);
        failed++;
        continue;
      }
      await pipeline(
        Readable.fromWeb(res.body as import("stream/web").ReadableStream),
        createWriteStream(videoPath),
      );

      // 2. Extract the last frame (0.5s before end) — Manim scenes start
      //    with a black fade-in, so the final frame shows the full scene.
      try {
        execFileSync(ffmpeg, [
          "-y", "-sseof", "-0.5", "-i", videoPath,
          "-frames:v", "1", "-q:v", "3", posterPath,
        ], { stdio: "ignore", timeout: 60_000 });
      } catch {
        // Fallback: midpoint frame
        execFileSync(ffmpeg, [
          "-y", "-ss", "1.0", "-i", videoPath,
          "-frames:v", "1", "-q:v", "3", posterPath,
        ], { stdio: "ignore", timeout: 60_000 });
      }

      // 3. Upload the JPEG to Supabase Storage
      const posterBuffer = readFileSync(posterPath);
      const { error: uploadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(posterName, posterBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) {
        console.warn(`[backfill] ${id}: upload failed:`, uploadError.message);
        failed++;
        continue;
      }
      const { data: publicData } = admin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(posterName);

      // 4. Update poster_url
      const { error: updateError } = await admin
        .from("visualizations")
        .update({ poster_url: publicData.publicUrl })
        .eq("id", id);
      if (updateError) {
        console.warn(`[backfill] ${id}: db update failed:`, updateError.message);
        failed++;
        continue;
      }

      console.log(`[backfill] ${id}: ✓ poster set`);
      ok++;
    } catch (err) {
      console.warn(`[backfill] ${id}: failed —`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n[backfill] Done. ok=${ok} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
