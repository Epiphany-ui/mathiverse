// src/lib/supabase/with-timeout.ts
export const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

/**
 * Attach a timeout to a Supabase query builder chain.
 *
 * supabase-js v2 queries are powered by postgrest-js, which accepts an
 * AbortSignal via `.abortSignal(signal)`. When the signal fires:
 *  - the in-flight fetch is genuinely aborted (and retry backoff cancelled),
 *  - the query settles with `{ data: null, error: { message: "AbortError: ..." } }`
 *    instead of throwing (shouldThrowOnError is false for `client.from(...)`),
 *    so existing `if (error || !data)` checks degrade gracefully (empty list /
 *    null -> notFound) rather than hanging forever.
 *
 * The signal propagates to derived builders (.eq/.single/etc.), so call this
 * at the end of the chain, right before `.single()` or `await`.
 */
export function withTimeout<
  T extends { abortSignal: (signal: AbortSignal) => T },
>(
  query: T,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): T {
  return query.abortSignal(AbortSignal.timeout(timeoutMs));
}
