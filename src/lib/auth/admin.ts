import { normProfile } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export class AdminAccessDenied extends Error {
  constructor(message = "需要管理员权限") {
    super(message);
    this.name = "AdminAccessDenied";
  }
}

async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createClient();
  if (!supabase) throw new AdminAccessDenied("Supabase 未配置");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AdminAccessDenied("请先登录");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) throw new AdminAccessDenied("用户资料不存在");

  // Enforce timed bans at the auth gate
  const normalized = normProfile(profile);
  if (normalized.bannedUntil && new Date(normalized.bannedUntil) > new Date()) {
    throw new AdminAccessDenied("账号已被封禁");
  }

  return normalized;
}

/**
 * Require admin or owner. Throws for regular users.
 */
export async function requireAdmin(): Promise<{ userId: string; profile: Profile }> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "owner") {
    throw new AdminAccessDenied("需要管理员权限");
  }
  return { userId: profile.id, profile };
}

/**
 * Require owner (super admin). Only the owner can manage other admins.
 */
export async function requireOwner(): Promise<{ userId: string; profile: Profile }> {
  const profile = await getCurrentProfile();
  if (profile.role !== "owner") {
    throw new AdminAccessDenied("只有馆长才能管理编辑");
  }
  return { userId: profile.id, profile };
}

export async function isAdmin(): Promise<boolean> {
  try { await requireAdmin(); return true; } catch { return false; }
}

export async function isOwner(): Promise<boolean> {
  try { await requireOwner(); return true; } catch { return false; }
}
