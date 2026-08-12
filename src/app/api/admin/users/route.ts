import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let currentUserId: string | null = null;
  try {
    const auth = await requireAdmin();
    currentUserId = auth.userId;
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

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const search = url.searchParams.get("search") ?? "";
  const pageSize = 20;

  let query = admin
    .from("profiles")
    .select("*", { count: "exact" });

  if (search) {
    // Sanitize for PostgREST filter: strip .or() grammar chars (`,`, `(`, `)`)
    // so the filter parses, escape LIKE wildcards (`%`, `_`) so they match
    // literally (usernames often contain underscores), and double single quotes.
    // Same pattern as searchContent.
    const searchSafe = search
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
      .replace(/[,()]/g, "");
    query = query.or(
      `username.ilike.%${searchSafe}%,display_name.ilike.%${searchSafe}%`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data,
    total: count ?? 0,
    currentUserId,
    page,
    pageSize,
  });
}
