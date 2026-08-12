import { createServerClient } from "@supabase/ssr";
import { createClient as createSupaClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Create a Supabase client for public read-only queries.
 *
 * Uses the anon key WITHOUT calling cookies(), which avoids triggering
 * Next.js Suspense streaming / PPR. Use this for public pages (home, wiki,
 * explore) where user identity is not required for the main data fetch.
 *
 * RLS still applies — this client has the same permissions as an
 * unauthenticated browser user.
 */
let _publicClient: ReturnType<typeof createSupaClient> | null = null;

export function getPublicClient() {
  if (_publicClient) return _publicClient;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url"
  ) {
    return null;
  }

  _publicClient = createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _publicClient;
}

export async function createClient() {
  // Return null when Supabase is not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url"
  ) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Set in Server Component — ignore if called from middleware
          }
        },
      },
    },
  );
}
