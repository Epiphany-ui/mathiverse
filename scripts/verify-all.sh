#!/usr/bin/env bash
# Full verification script — run after login as admin in browser
# Usage: ./scripts/verify-all.sh [session-cookie]
# If session-cookie is provided, also tests admin batch operations

set -euo pipefail
APP="${APP_URL:-http://localhost:3000}"

echo "=== Mathiverse 全面验证 ==="
echo ""

PASS=0
FAIL=0

check() { local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then echo "  ✓ $name"; PASS=$((PASS+1))
  else echo "  ✗ $name (expected $expected, got $actual)"; FAIL=$((FAIL+1)); fi
}

# Code quality
echo "1. 代码质量"
npx tsc --noEmit > /dev/null 2>&1 && check "TypeScript" "0" "0" || check "TypeScript" "0" "1"

T=$(node -e "const{execSync}=require('child_process');const o=execSync('pnpm test --run 2>&1').toString();const m=o.match(/fail (\d+)/);console.log(m?m[1]:'?')" 2>/dev/null || echo "?")
check "Unit tests (102/0)" "0" "$T"

# Pages
echo ""
echo "2. 页面可达性"
for p in / /explore /search /wiki /auth/login /auth/register /auth/reset-password; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$APP$p")
  check "  $p" "200" "$code"
done

# Protected pages
for p in /sandbox /settings /create /admin /wiki/new; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$APP$p")
  check "  $p → login redirect" "307" "$code"
done

# No spinner on key pages
echo ""
echo "3. 无 spinner bug"
for p in / /wiki; do
  has=$(curl -s "$APP$p" | grep -o "加载中" | wc -l)
  check "  $p" "0" "$has"
done

# Batch API
echo ""
echo "4. 批量操作 API"
for action in ban_users unban_users delete_content publish_wiki unpublish_wiki; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$APP/api/admin/batch" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"$action\",\"targets\":[\"test\"]}")
  check "  $action (401=need auth)" "401" "$code"
done

# RLS
echo ""
echo "5. RLS 验证"
set -a; source .env.local 2>/dev/null; set +a
anon=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wiki_entries?select=count&is_published=eq.false" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['count'])" 2>/dev/null || echo "?")
check "  匿名用户不可读未发布 wiki" "0" "$anon"

# Admin batch test with session cookie
if [ -n "${1:-}" ]; then
  echo ""
  echo "6. 管理员批量操作（使用 session cookie）"
  # Test publish
  result=$(curl -s -X POST "$APP/api/admin/batch" \
    -H "Content-Type: application/json" \
    -H "Cookie: $1" \
    -d '{"action":"publish_wiki","targets":["golden-ratio"]}' 2>/dev/null)
  summary=$(echo "$result" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('summary',{}).get('succeeded','?'))" 2>/dev/null || echo "?")
  check "  批量发布 wiki" "1" "$summary"
else
  echo ""
  echo "6. 管理员批量操作 — 跳过（未提供 session cookie）"
  echo "   使用方法: ./scripts/verify-all.sh 'sb-access-token=YOUR_TOKEN'"
fi

echo ""
echo "=== $PASS/$((PASS+FAIL)) 通过 ==="
exit $FAIL
