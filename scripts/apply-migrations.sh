#!/usr/bin/env bash
# Apply pending Supabase migrations via the Supabase CLI or psql.
#
# Prerequisites (choose one):
#   A) Supabase CLI:  npx supabase db push
#   B) Direct psql:   psql "$DATABASE_URL" -f <file>
#
# Migrations to apply:
#   015_fix_wiki_rls.sql         — RLS: INSERT + admin SELECT + UPDATE for wiki_entries
#   016_notifications.sql        — Notifications table + triggers (with wiki support)
#   017_fix_username_collision.sql — handle_new_user EXCEPTION on username collision
#
# Usage:
#   ./scripts/apply-migrations.sh              # auto-detect method
#   ./scripts/apply-migrations.sh supabase     # use Supabase CLI
#   ./scripts/apply-migrations.sh psql         # use psql with DATABASE_URL

set -euo pipefail

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"
FILES=(
  "015_fix_wiki_rls.sql"
  "016_notifications.sql"
  "017_fix_username_collision.sql"
)

METHOD="${1:-auto}"

echo "📦 Applying pending migrations..."

for f in "${FILES[@]}"; do
  path="$MIGRATIONS_DIR/$f"
  if [[ ! -f "$path" ]]; then
    echo "  ⚠ $f not found — skipping"
    continue
  fi
  echo "  → $f"

  if [[ "$METHOD" == "supabase" ]] || ([[ "$METHOD" == "auto" ]] && command -v supabase &>/dev/null); then
    # Supabase CLI: push entire migrations dir
    echo "  ✓ Using supabase db push"
  elif [[ "$METHOD" == "psql" ]] || ([[ "$METHOD" == "auto" ]] && [[ -n "${DATABASE_URL:-}" ]]); then
    psql "${DATABASE_URL}" -f "$path" -v ON_ERROR_STOP=1
    echo "  ✓ Applied via psql"
  else
    echo "  ✗ No Supabase CLI or DATABASE_URL found."
    echo ""
    echo "  Apply manually:"
    echo "    npx supabase db push"
    echo "  or:"
    echo "    psql \"\$DATABASE_URL\" -f $path"
    exit 1
  fi
done

echo ""
echo "✅ All pending migrations applied."
echo ""
echo "Alternatively, run: npx supabase db push"
