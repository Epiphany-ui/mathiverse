// Resolve the owner of a generation API request.
// Authenticated users have { kind: "user", userId }.
// Anonymous visitors get a signed session cookie with { kind: "anonymous", sessionHash }.
// In production, anonymous creation (POST) can be disabled via ALLOW_ANONYMOUS_GENERATION.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  createSignedAnonymousSession,
  hashAnonymousSession,
  SANDBOX_SESSION_COOKIE,
  verifySignedAnonymousSession,
} from "./session";
import type { GenerationOwner } from "./job-store";

function getSecret(): string | null {
  return process.env.GENERATION_SESSION_SECRET ?? null;
}

export async function resolveRequestOwner(opts?: {
  requireAuth?: boolean;
}): Promise<{
  owner: GenerationOwner | null;
  error?: { status: number; message: string };
}> {
  // 1. Try authenticated user first
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return { owner: { kind: "user", userId: user.id } };
    }
  } catch {
    // Auth unavailable — fall through
  }

  // 2. If authentication is required, stop here
  if (opts?.requireAuth) {
    return {
      owner: null,
      error: { status: 401, message: "请先登录后再使用生成功能" },
    };
  }

  // 3. Anonymous session via signed cookie
  const secret = getSecret();
  if (!secret) {
    return {
      owner: null,
      error: {
        status: 503,
        message: "GENERATION_SESSION_SECRET 未配置，无法创建匿名会话",
      },
    };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(SANDBOX_SESSION_COOKIE)?.value;

  if (existing) {
    const sessionId = verifySignedAnonymousSession(secret, existing);
    if (sessionId) {
      return {
        owner: { kind: "anonymous", sessionHash: hashAnonymousSession(sessionId) },
      };
    }
  }

  // Create new anonymous session
  const token = createSignedAnonymousSession(secret);
  const sessionId = token.split(".")[0];
  const owner: GenerationOwner = {
    kind: "anonymous",
    sessionHash: hashAnonymousSession(sessionId),
  };

  cookieStore.set(SANDBOX_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/generation",
    maxAge: 60 * 60 * 24,
  });

  return { owner };
}
