-- ============================================================
-- Mathiverse Migration 002: Wiki Entries
-- 复制到 Supabase SQL Editor 执行
-- ============================================================
-- 新增百科词条表 + 扩展 polymorphic target_type 约束 + 扩展触发器

-- ============================================================
-- 1. Wiki Entries 表
-- ============================================================

CREATE TABLE IF NOT EXISTS wiki_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pure-math', 'applied-math', 'cs-overlap')),
  summary TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL,
  cover_url TEXT,
  tags TEXT[] DEFAULT '{}',
  wikipedia_title TEXT,
  wikipedia_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_entries_category ON wiki_entries(category);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_published ON wiki_entries(is_published);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_created ON wiki_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_updated ON wiki_entries(updated_at DESC);

-- RLS: 所有人可读已发布词条；只有 service_role 可写入（admin client）
ALTER TABLE wiki_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_read_published" ON wiki_entries FOR SELECT USING (is_published = true);

-- ============================================================
-- 2. 扩展 target_type CHECK 约束 — 加入 'wiki'
-- ============================================================

-- comments
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('visualization', 'article', 'wiki'));

-- likes
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_target_type_check;
ALTER TABLE likes ADD CONSTRAINT likes_target_type_check
  CHECK (target_type IN ('visualization', 'article', 'comment', 'wiki'));

-- bookmarks
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_target_type_check;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_target_type_check
  CHECK (target_type IN ('visualization', 'article', 'wiki'));

-- ============================================================
-- 3. 扩展计数器触发器 — 加入 wiki branch
-- ============================================================

-- handle_like_insert
CREATE OR REPLACE FUNCTION handle_like_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'visualization' THEN
    UPDATE visualizations SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    UPDATE articles SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'wiki' THEN
    UPDATE wiki_entries SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

-- handle_like_delete
CREATE OR REPLACE FUNCTION handle_like_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.target_type = 'visualization' THEN
    UPDATE visualizations SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'article' THEN
    UPDATE articles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'comment' THEN
    UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'wiki' THEN
    UPDATE wiki_entries SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$;

-- handle_comment_insert
CREATE OR REPLACE FUNCTION handle_comment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'visualization' THEN
    UPDATE visualizations SET comments_count = comments_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    UPDATE articles SET comments_count = comments_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'wiki' THEN
    UPDATE wiki_entries SET comments_count = comments_count + 1 WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

-- handle_comment_delete
CREATE OR REPLACE FUNCTION handle_comment_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.target_type = 'visualization' THEN
    UPDATE visualizations SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'article' THEN
    UPDATE articles SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'wiki' THEN
    UPDATE wiki_entries SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$;

-- increment_views RPC
CREATE OR REPLACE FUNCTION increment_views(
  target_type TEXT,
  target_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_type = 'visualization' THEN
    UPDATE visualizations SET views_count = views_count + 1 WHERE id = target_id;
  ELSIF target_type = 'article' THEN
    UPDATE articles SET views_count = views_count + 1 WHERE id = target_id;
  ELSIF target_type = 'wiki' THEN
    UPDATE wiki_entries SET views_count = views_count + 1 WHERE id = target_id;
  END IF;
END;
$$;
