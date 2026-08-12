// POST /api/admin/batch — bulk operations across admin entities
//
// Body: { action: string; targets: string[]; params?: Record<string, unknown> }
//
// Supported actions:
//   ban_users      — ban users by ID, params.duration ("" = permanent)
//   unban_users    — unban users by ID
//   delete_content — delete content by type+ID (targets: "visualizations:abc123")
//   publish_wiki   — publish wiki entries by slug
//   unpublish_wiki — unpublish wiki entries by slug

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = [
  "ban_users",
  "unban_users",
  "delete_content",
  "publish_wiki",
  "unpublish_wiki",
] as const;

type BatchAction = (typeof VALID_ACTIONS)[number];

export async function POST(request: Request) {
  let adminUserId: string;
  try {
    const auth = await requireAdmin();
    adminUserId = auth.userId;
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  let body: { action?: string; targets?: string[]; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const { action, targets = [], params = {} } = body;

  if (!action || !VALID_ACTIONS.includes(action as BatchAction)) {
    return NextResponse.json(
      { error: `无效的操作，可选: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  if (!targets.length) {
    return NextResponse.json({ error: "targets 不能为空" }, { status: 400 });
  }

  const results: { target: string; ok: boolean; error?: string }[] = [];

  switch (action as BatchAction) {
    // ─── Users ──────────────────────────────────────────
    case "ban_users": {
      const duration = typeof params.duration === "string" ? params.duration : null;
      let bannedUntil: string;
      if (duration === "1h") bannedUntil = new Date(Date.now() + 3600_000).toISOString();
      else if (duration === "1d") bannedUntil = new Date(Date.now() + 86400_000).toISOString();
      else if (duration === "7d") bannedUntil = new Date(Date.now() + 604800_000).toISOString();
      else if (duration === "30d") bannedUntil = new Date(Date.now() + 2592000_000).toISOString();
      else bannedUntil = "2999-12-31T23:59:59Z"; // permanent

      // Fetch profiles to check for owners/admins (protected)
      const { data: profiles } = await (admin as any)
        .from("profiles")
        .select("id, role")
        .in("id", targets);

      const protectedIds = new Set(
        (profiles ?? []).filter((p: any) => p.role === "owner").map((p: any) => p.id),
      );

      for (const id of targets) {
        if (protectedIds.has(id)) {
          results.push({ target: id, ok: false, error: "不能封禁馆主" });
          continue;
        }
        const { error } = await (admin as any)
          .from("profiles")
          .update({ banned_until: bannedUntil })
          .eq("id", id);
        if (error) {
          results.push({ target: id, ok: false, error: error.message });
        } else {
          results.push({ target: id, ok: true });
        }
      }

      // Audit log
      (admin as any).from("admin_audit_log").insert({
        admin_id: adminUserId,
        action: "batch_ban_users",
        target_type: "profiles",
        details: { count: targets.length, duration: duration ?? "permanent" },
      }).then(() => {}, () => {});
      break;
    }

    case "unban_users": {
      for (const id of targets) {
        const { error } = await (admin as any)
          .from("profiles")
          .update({ banned_until: null })
          .eq("id", id);
        results.push({ target: id, ok: !error, error: error?.message });
      }
      (admin as any).from("admin_audit_log").insert({
        admin_id: adminUserId,
        action: "batch_unban_users",
        target_type: "profiles",
        details: { count: targets.length },
      }).then(() => {}, () => {});
      break;
    }

    // ─── Content ────────────────────────────────────────
    case "delete_content": {
      // targets format: "visualizations:abc123" or "articles:abc123"
      const byType = new Map<string, string[]>();
      for (const t of targets) {
        const [type, id] = t.split(":", 2);
        if (type && id) {
          if (!byType.has(type)) byType.set(type, []);
          byType.get(type)!.push(id);
        }
      }

      const TABLE_MAP: Record<string, string> = {
        visualization: "visualizations",
        visualizations: "visualizations",
        article: "articles",
        articles: "articles",
        wiki_entries: "wiki_entries",
        comments: "comments",
      };
      for (const [type, ids] of byType) {
        const table = TABLE_MAP[type];
        if (!table) continue;
        const { error } = await (admin as any)
          .from(table)
          .delete()
          .in("id", ids);
        for (const id of ids) {
          results.push({ target: `${type}:${id}`, ok: !error, error: error?.message });
        }
      }
      (admin as any).from("admin_audit_log").insert({
        admin_id: adminUserId,
        action: "batch_delete_content",
        target_type: "content",
        details: { count: targets.length },
      }).then(() => {}, () => {});
      break;
    }

    // ─── Wiki ───────────────────────────────────────────
    case "publish_wiki":
    case "unpublish_wiki": {
      const isPublished = action === "publish_wiki";
      for (const slug of targets) {
        const { error } = await (admin as any)
          .from("wiki_entries")
          .update({ is_published: isPublished })
          .eq("slug", slug);
        results.push({ target: slug, ok: !error, error: error?.message });
      }
      (admin as any).from("admin_audit_log").insert({
        admin_id: adminUserId,
        action: `batch_${isPublished ? "publish" : "unpublish"}_wiki`,
        target_type: "wiki_entries",
        details: { count: targets.length },
      }).then(() => {}, () => {});
      break;
    }
  }

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    },
  });
}
