-- ============================================================
-- Mathiverse Migration 007: Admin Role + Wiki Author + Audit Log
-- ============================================================

-- 1. profiles.role
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2. wiki_entries.author_id + index
ALTER TABLE wiki_entries ADD COLUMN IF NOT EXISTS author_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wiki_entries_author ON wiki_entries(author_id);

-- 3. 管理操作审计日志
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
