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
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

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

  const body = await request.json();
  const { id, all } = body;

  if (all) {
    await markAllAsRead(supabase, user.id);
  } else if (id) {
    await markAsRead(supabase, id);
  }

  return NextResponse.json({ success: true });
}
