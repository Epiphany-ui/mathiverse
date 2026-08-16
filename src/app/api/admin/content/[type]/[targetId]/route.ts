/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = ["visualizations", "articles", "wiki_entries", "comments"] as const;

interface RouteParams {
  params: Promise<{ type: string; targetId: string }>;
}

export async function DELETE(
  _request: Request,
  { params }: RouteParams,
) {
  let userId: string;
  try {
    const auth = await requireAdmin();
    userId = auth.userId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "无权限" },
      { status: 401 },
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  const { type, targetId } = await params;

  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: `不支持的内容类型: ${type}` },
      { status: 400 },
    );
  }

  const { error } = await admin.from(type).delete().eq("id", targetId);

  if (error) {
    return NextResponse.json({ error: "删除失败，请重试" }, { status: 500 });
  }

  // Audit log (fire-and-forget)
  (admin as any).from("admin_audit_log").insert({
    admin_id: userId,
    action: "delete_content",
    target_type: type,
    target_id: targetId,
    details: { deleted_at: new Date().toISOString() },
  }).then(() => {}, () => {});

  return NextResponse.json({ success: true });
}
