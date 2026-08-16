import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Only allow same-site relative paths — blocks `//evil.com` open redirects. */
function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  // Must be a local path: starts with a single "/" and not with "//" or "/\\".
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
