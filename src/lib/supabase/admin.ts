/**
 * Supabase admin client — server-side only.
 *
 * Uses the service_role key for privileged operations (storage uploads).
 * NEVER import this in client components.
 */
import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn("[supabase/admin] Missing SUPABASE_SERVICE_ROLE_KEY — storage uploads disabled");
    return null;
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return adminClient;
}

/** Ensure the storage bucket exists, creating it if needed. */
export async function ensureStorageBucket(
  bucketName: string,
  opts?: {
    allowedMimeTypes?: string[];
    fileSizeLimit?: number;
  },
): Promise<boolean> {
  const client = getAdminClient();
  if (!client) return false;

  try {
    // Check if bucket exists
    const { data: buckets, error: listErr } =
      await client.storage.listBuckets();

    if (listErr) {
      console.error("[supabase/admin] Failed to list buckets:", listErr);
      return false;
    }

    const exists = buckets?.some((b) => b.name === bucketName);
    if (exists) return true;

    // Create the bucket (public so files are directly accessible)
    const { error: createErr } = await client.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: opts?.fileSizeLimit ?? 50 * 1024 * 1024, // 50 MB — Supabase free tier limit
      allowedMimeTypes: opts?.allowedMimeTypes ?? ["video/mp4", "video/webm", "image/gif"],
    });

    if (createErr) {
      console.error("[supabase/admin] Failed to create bucket:", createErr);
      return false;
    }

    console.log(`[supabase/admin] Created storage bucket: ${bucketName}`);
    return true;
  } catch (err) {
    console.error("[supabase/admin] Bucket check failed:", err);
    return false;
  }
}

/** Upload a buffer to Supabase Storage and return the public URL. */
export async function uploadToStorage(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const client = getAdminClient();
  if (!client) return null;

  const { error } = await client.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error("[supabase/admin] Upload failed:", error);
    return null;
  }

  const { data } = client.storage.from(bucketName).getPublicUrl(filePath);

  return data.publicUrl;
}

/** Upload a video buffer to Supabase Storage and return the public URL.
 *  @deprecated Use uploadToStorage instead. */
export async function uploadVideoToStorage(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  return uploadToStorage(bucketName, filePath, buffer, mimeType);
}
