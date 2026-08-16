import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  // Skip auth when Supabase is not configured (dev mode)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url"
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enforce timed bans on ALL routes (pages + API), skip static assets only.
  // Admin API routes re-check the ban inside requireAdmin/requireOwner
  // (getCurrentProfile), so this extra round trip is skipped for them —
  // every admin action used to pay for this query twice.
  const isStatic = request.nextUrl.pathname.startsWith("/_next/");
  const isAdminApi = request.nextUrl.pathname.startsWith("/api/admin/");

  if (user && !isStatic && !isAdminApi) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned_until")
      .eq("id", user.id)
      .single();

    if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
      await supabase.auth.signOut();
      const isApi = request.nextUrl.pathname.startsWith("/api/");
      if (isApi) {
        // API: return 403 JSON, carry sign-out cookies
        const res = NextResponse.json(
          { error: "你的账号已被封禁。如有疑问请联系管理员。" },
          { status: 403 },
        );
        for (const cookie of supabaseResponse.cookies.getAll()) {
          res.cookies.set(cookie.name, cookie.value, cookie);
        }
        return res;
      }
      // Page: redirect to login with error param
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("error", "banned");
      const res = NextResponse.redirect(url);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        res.cookies.set(cookie.name, cookie.value, cookie);
      }
      return res;
    }
  }

  // Protected routes: redirect to /auth/login if not authenticated
  const protectedPaths = ["/sandbox", "/settings", "/create", "/admin", "/wiki/new"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
