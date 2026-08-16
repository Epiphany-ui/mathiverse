/**
 * GET  /api/notifications — Get notifications for current user
 * PATCH /api/notifications — Mark notifications as read
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/lib/db/notifications";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const parsedLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(50, Math.max(1, parsedLimit))
    : 20;

  if (unreadOnly) {
    const count = await getUnreadCount(supabase, user.id);
    return NextResponse.json({ count });
  }

  const notifications = await getNotifications(supabase, user.id, limit);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
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
  const { id, all } = body as { id?: unknown; all?: unknown };

  if (all === true) {
    await markAllAsRead(supabase, user.id);
  } else if (typeof id === "string" && id.length > 0) {
    await markAsRead(supabase, user.id, id);
  } else {
    return NextResponse.json({ error: "缺少通知 id" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
