/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
) {
  let adminUserId: string;
  try {
    const auth = await requireAdmin();
    adminUserId = auth.userId;
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

  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "没有可更新的字段" },
      { status: 400 },
    );
  }

  const { data, error } = await (admin as any)
    .from("wiki_entries")
    .update(updates)
    .eq("slug", slug)
    .select("id, slug, title")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  const action = body.is_published ? "publish_wiki" : "unpublish_wiki";
  (admin as any).from("admin_audit_log").insert({
    admin_id: adminUserId,
    action,
    target_type: "wiki_entries",
    target_id: data.id,
    details: { slug: data.slug, title: data.title },
  }).then(() => {}, () => {});

  return NextResponse.json({ entry: data });
}
