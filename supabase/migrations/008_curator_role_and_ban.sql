-- ============================================================
-- Mathiverse Migration 008: Owner Role + Ban
-- ============================================================

-- 1. 扩展 role CHECK 约束：owner / admin / user
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'user'));

-- 2. 添加 banned 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
