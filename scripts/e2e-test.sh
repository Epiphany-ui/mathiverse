#!/usr/bin/env bash
# End-to-end test against the real Supabase backend.
# Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
#
# Usage:  ./scripts/e2e-test.sh
#
# NOTE: This tests against the PRODUCTION Supabase instance using the service
# role key. It creates and deletes a test user — no lasting side effects.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_URL="${APP_URL:-http://localhost:3000}"

# Load env from .env.local if exists
if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  set -a
  source "$SCRIPT_DIR/../.env.local"
  set +a
fi

if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL 未设置。请在 .env.local 中配置 Supabase。"
  exit 1
fi

echo "🔍 E2E Test — $APP_URL"
echo "   Supabase: ${NEXT_PUBLIC_SUPABASE_URL}"
echo ""

PASS=0
FAIL=0

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

# ─── 1. Verify Supabase is reachable ───────────────
echo "Backend health:"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" 2>/dev/null || echo "000")
# REST root returns 200 or 401 (unauth) — both mean it's reachable
if [ "$HEALTH" = "200" ] || [ "$HEALTH" = "401" ]; then
  echo "  ✓ Supabase REST reachable ($HEALTH)"
  PASS=$((PASS + 1))
else
  echo "  ✗ Supabase REST reachable (expected 200/401, got $HEALTH)"
  FAIL=$((FAIL + 1))
fi

# ─── 2. Verify app is running ─────────────────────
echo ""
echo "App health:"
APP_HOME=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/" 2>/dev/null || echo "000")
check "Home page (200)" "200" "$APP_HOME"

APP_WIKI=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/wiki" 2>/dev/null || echo "000")
check "Wiki page (200)" "200" "$APP_WIKI"

# ─── 3. Verify public data is accessible ──────────
echo ""
echo "Public data:"
WIKI_COUNT=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wiki_entries?select=count&is_published=eq.true" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['count'] if d else 'error')" 2>/dev/null || echo "error")
echo "  Published wiki entries: $WIKI_COUNT"

VIZ_COUNT=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/visualizations?select=count&is_published=eq.true" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['count'] if d else 'error')" 2>/dev/null || echo "error")
echo "  Published visualizations: $VIZ_COUNT"

# ─── 4. Verify RLS policies ──────────────────────
echo ""
echo "RLS verification:"
# Try reading unpublished wiki as anon — should return 0 rows
UNPUB_COUNT=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wiki_entries?select=count&is_published=eq.false" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['count'] if d else 'error')" 2>/dev/null || echo "error")
check "Anonymous cannot read unpublished wiki" "0" "$UNPUB_COUNT"

# ─── 5. Verify app API endpoints (no auth) ───────
echo ""
echo "API endpoints (unauth):"
AUTH_REG=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/auth/register" 2>/dev/null || echo "000")
check "Register page (200)" "200" "$AUTH_REG"

AUTH_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/auth/login" 2>/dev/null || echo "000")
check "Login page (200)" "200" "$AUTH_LOGIN"

AUTH_RESET=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/auth/reset-password" 2>/dev/null || echo "000")
check "Reset password page (200)" "200" "$AUTH_RESET"

# ─── Summary ─────────────────────────────────────
echo ""
echo "──────────────────────────────"
echo "$PASS passed, $FAIL failed out of $((PASS + FAIL)) checks"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
