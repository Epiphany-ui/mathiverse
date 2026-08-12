-- ============================================================
-- Mathiverse 管理员初始化脚本
-- 在 Supabase SQL Editor 中手动执行一次
-- ============================================================

-- 1. 先执行迁移（如果还没执行）
--    在 Supabase SQL Editor 中运行 supabase/migrations/007_admin_and_wiki_author.sql

-- 2. 设你的账号为管理员（替换 YOUR_USERNAME 为你的实际用户名）
UPDATE profiles SET role = 'admin' WHERE username = 'YOUR_USERNAME';

-- 3. 把所有现有 Wiki 词条归属给管理员
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NOT NULL THEN
    UPDATE wiki_entries SET author_id = admin_id WHERE author_id IS NULL;
    RAISE NOTICE '已将 % 个词条归属管理员 %', (SELECT count(*) FROM wiki_entries WHERE author_id = admin_id), admin_id;
  END IF;
END $$;

-- 4. 验证
SELECT id, username, role FROM profiles WHERE role = 'admin';
SELECT count(*) AS wiki_entries_with_author FROM wiki_entries WHERE author_id IS NOT NULL;
