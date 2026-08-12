/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
) {
  // Both owner and admin can ban/unban, but only owner can change roles
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const isRoleChange = typeof body.role === "string" && ["owner", "admin", "user"].includes(body.role);
  const isBanChange = typeof body.banned === "boolean";

  // --- Role change: owner only ---
  if (isRoleChange) {
    let ownerProfile;
    try {
      const auth = await requireOwner();
      ownerProfile = auth.profile;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "无权限" },
        { status: 403 },
      );
    }

    // Can't demote yourself
    if (id === ownerProfile.id) {
      return NextResponse.json(
        { error: "不能修改自己的角色" },
        { status: 400 },
      );
    }

    // Block promoting anyone to owner via API — ownership transfer is SQL-only
    if (body.role === "owner") {
      return NextResponse.json(
        { error: "馆长身份只能通过数据库直接操作转让" },
        { status: 403 },
      );
    }

    // Can't demote another owner (only the owner themselves via SQL)
    const { data: target } = await (admin as any)
      .from("profiles").select("role").eq("id", id).single();
    if (target?.role === "owner") {
      return NextResponse.json(
        { error: "只有馆长本人才能转让馆长身份" },
        { status: 403 },
      );
    }

    updates.role = body.role;
  }

  // --- Ban/unban: admin or owner ---
  // { banned: true, duration?: "1h"|"1d"|"7d"|"30d"|null }
  // { banned: false } means unban
  // duration without banned:true is ignored — prevents accidental permabans
  if (isBanChange) {
    try {
      const { data: target } = await (admin as any)
        .from("profiles").select("role").eq("id", id).single();
      if (target?.role === "owner") {
        return NextResponse.json({ error: "不能封禁馆长" }, { status: 403 });
      }
      // Only the owner can ban another admin
      const auth = target?.role === "admin"
        ? await requireOwner()
        : await requireAdmin();
      if (id === auth.userId) {
        return NextResponse.json({ error: "不能封禁自己" }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "无权限" },
        { status: 403 },
      );
    }

    if (body.banned === false) {
      // Unban
      updates.banned_until = null;
    } else {
      // Ban with optional duration
      const duration = typeof body.duration === "string" ? body.duration : null;
      if (duration) {
        const match = duration.match(/^(\d+)([hd])$/);
        if (match) {
          const n = parseInt(match[1]);
          const unit = match[2];
          const ms = unit === "h" ? n * 3600000 : n * 86400000;
          updates.banned_until = new Date(Date.now() + ms).toISOString();
        } else {
          return NextResponse.json(
            { error: "duration 格式无效，请使用如 1h、7d、30d" },
            { status: 400 },
          );
        }
      }
      // No duration = permanent (leave banned_until as null... actually set far future)
      if (!updates.banned_until && !duration) {
        updates.banned_until = "2999-12-31T23:59:59Z";
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "没有可更新的字段" },
      { status: 400 },
    );
  }

  const { data, error } = await (admin as any)
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  const actorId = (await requireAdmin().catch(() => ({ userId: null })))?.userId ?? null;
  if (actorId) {
    await (admin as any).from("admin_audit_log").insert({
      admin_id: actorId,
      action: isRoleChange ? "change_role" : isBanChange ? (body.banned ? "ban" : "unban") : "update_user",
      target_type: "profile",
      target_id: id,
      details: updates,
    }).then(() => {}, () => {});
  }

  return NextResponse.json({ user: data });
}
