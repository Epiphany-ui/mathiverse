-- ============================================================
-- 将现有用户提升为管理员（在 Supabase SQL Editor 执行）
-- ============================================================
-- 注意：role CHECK 约束只允许 'owner'、'admin'、'user'（migration 008）。
-- 'curator' 角色已弃用，请使用 'admin'。

-- 1. 先执行迁移
--    supabase/migrations/008_curator_role_and_ban.sql

-- 2. 把你现有的账号升级为管理员
--    替换 <YOUR_USER_ID> 为你的实际 ID
UPDATE profiles SET role = 'admin' WHERE id = '<YOUR_USER_ID>';
-- 如果按用户名更新：
-- UPDATE profiles SET role = 'admin' WHERE username = '<YOUR_USERNAME>';

-- 3. 验证
SELECT id, username, role FROM profiles WHERE role IN ('admin', 'owner');
