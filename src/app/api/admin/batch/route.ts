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
import { asAdminDb, getAdminClient } from "@/lib/supabase/admin";

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
  let actorRole: string;
  try {
    const auth = await requireAdmin();
    adminUserId = auth.userId;
    actorRole = auth.profile.role ?? "user";
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }
  const db = asAdminDb(admin);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  const parsed = body as { action?: unknown; targets?: unknown; params?: unknown };

  const action = typeof parsed.action === "string" ? parsed.action : "";
  const targets = Array.isArray(parsed.targets)
    ? parsed.targets.filter((t): t is string => typeof t === "string")
    : [];
  const params =
    parsed.params && typeof parsed.params === "object" && !Array.isArray(parsed.params)
      ? (parsed.params as Record<string, unknown>)
      : {};

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
    case "ban_users":
    case "unban_users": {
      const isBan = action === "ban_users";
      const duration = typeof params.duration === "string" ? params.duration : null;
      if (duration !== null && !["1h", "1d", "7d", "30d"].includes(duration)) {
        return NextResponse.json(
          { error: "duration 必须是 1h、1d、7d 或 30d" },
          { status: 400 },
        );
      }
      let bannedUntil: string;
      if (duration === "1h") bannedUntil = new Date(Date.now() + 3600_000).toISOString();
      else if (duration === "1d") bannedUntil = new Date(Date.now() + 86400_000).toISOString();
      else if (duration === "7d") bannedUntil = new Date(Date.now() + 604800_000).toISOString();
      else if (duration === "30d") bannedUntil = new Date(Date.now() + 2592000_000).toISOString();
      else bannedUntil = "2999-12-31T23:59:59Z"; // permanent

      // Only valid UUIDs reach the database; anything else is reported
      // per-target without aborting the whole batch.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = targets.filter((t) => UUID_RE.test(t));
      for (const t of targets) {
        if (!UUID_RE.test(t)) {
          results.push({ target: t, ok: false, error: "无效的用户 ID" });
        }
      }

      // Fetch profiles to enforce the same role boundaries as the single-user
      // endpoint: owners are untouchable, admins may only be managed by the
      // owner, and nobody can ban/unban themselves.  A failed lookup aborts —
      // proceeding blind could ban the owner.
      const { data: profiles, error: lookupError } = await db
        .from("profiles")
        .select("id, role")
        .in("id", validIds);
      if (lookupError) {
        return NextResponse.json(
          { error: "查询用户失败，已中止批量操作" },
          { status: 500 },
        );
      }
      const roleById = new Map<string, string | null>(
        (profiles ?? []).map((p) => [p.id as string, p.role as string | null]),
      );

      // Decide each target's fate first, then run the writes in parallel
      // instead of serially awaiting every row (one round trip per row used
      // to make bulk admin actions feel sluggish).
      const toUpdate: string[] = [];
      const decisions = new Map<string, { ok: boolean; error: string }>();
      for (const id of validIds) {
        const targetRole = roleById.get(id);
        if (targetRole === "owner") {
          decisions.set(id, { ok: false, error: "不能操作馆长账号" });
        } else if (id === adminUserId) {
          decisions.set(id, {
            ok: false,
            error: isBan ? "不能封禁自己" : "不能解封自己",
          });
        } else if (targetRole === "admin" && actorRole !== "owner") {
          decisions.set(id, { ok: false, error: "只有馆长才能管理编辑" });
        } else {
          toUpdate.push(id);
        }
      }

      const settled = await Promise.all(
        toUpdate.map(async (id) => {
          const { error } = await db
            .from("profiles")
            .update({ banned_until: isBan ? bannedUntil : null })
            .eq("id", id);
          return { id, error };
        }),
      );

      for (const id of validIds) {
        const decided = decisions.get(id);
        if (decided) {
          results.push({ target: id, ...decided });
          continue;
        }
        const outcome = settled.find((s) => s.id === id);
        results.push(
          outcome?.error
            ? { target: id, ok: false, error: outcome.error.message }
            : { target: id, ok: true },
        );
      }

      // Audit log
      db.from("admin_audit_log").insert({
        admin_id: adminUserId,
        action: isBan ? "batch_ban_users" : "batch_unban_users",
        target_type: "profiles",
        details: { count: targets.length, duration: isBan ? (duration ?? "permanent") : undefined },
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
      const deleteResults = await Promise.all(
        [...byType.entries()].map(async ([type, ids]) => {
          const table = TABLE_MAP[type];
          if (!table) return { type, ids, error: null };
          const { error } = await db
            .from(table)
            .delete()
            .in("id", ids);
          return { type, ids, error };
        }),
      );
      for (const { type, ids, error } of deleteResults) {
        for (const id of ids) {
          results.push({ target: `${type}:${id}`, ok: !error, error: error?.message });
        }
      }
      db.from("admin_audit_log").insert({
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
      const wikiResults = await Promise.all(
        targets.map(async (slug) => {
          const { error } = await db
            .from("wiki_entries")
            .update({ is_published: isPublished })
            .eq("slug", slug);
          return { slug, error };
        }),
      );
      for (const { slug, error } of wikiResults) {
        results.push({ target: slug, ok: !error, error: error?.message });
      }
      db.from("admin_audit_log").insert({
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
