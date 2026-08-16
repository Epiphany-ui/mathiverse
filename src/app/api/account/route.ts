// DELETE /api/account — delete the authenticated user's own account

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "服务未配置，无法删除账号" },
      { status: 503 },
    );
  }

  // The owner (super admin) account must not be deletable — there would be
  // no one left able to manage the site.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile && (profile as { role?: string | null }).role === "owner") {
    return NextResponse.json(
      { error: "馆长账号无法自行删除" },
      { status: 403 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json(
      { error: "删除账号失败，请重试" },
      { status: 500 },
    );
  }

  // Clear the session cookies by signing out
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
