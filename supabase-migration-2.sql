-- ============================================================
-- Mathiverse Migration 2: Social Interaction Triggers
-- 复制到 Supabase SQL Editor 执行
-- ============================================================
-- 解决问题: RLS 只允许作者 UPDATE visualizations/articles/comments,
-- 但点赞/评论/收藏需要非作者也能更新计数。
-- 方案: SECURITY DEFINER 触发器，以表所有者身份执行 UPDATE。
-- ============================================================

-- ============================================================
-- 1. Likes 触发器 — 自动更新 likes_count
-- ============================================================

-- 点赞时 +1
CREATE OR REPLACE FUNCTION handle_like_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'visualization' THEN
    UPDATE visualizations SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    UPDATE articles SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 取消点赞时 -1
CREATE OR REPLACE FUNCTION handle_like_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.target_type = 'visualization' THEN
    UPDATE visualizations SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'article' THEN
    UPDATE articles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'comment' THEN
    UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_like_insert ON likes;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_insert();

DROP TRIGGER IF EXISTS on_like_delete ON likes;
CREATE TRIGGER on_like_delete
  AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_delete();

-- ============================================================
-- 2. Comments 触发器 — 自动更新 comments_count
-- ============================================================

CREATE OR REPLACE FUNCTION handle_comment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_type = 'visualization' THEN
    UPDATE visualizations SET comments_count = comments_count + 1 WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    UPDATE articles SET comments_count = comments_count + 1 WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_comment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.target_type = 'visualization' THEN
    UPDATE visualizations SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'article' THEN
    UPDATE articles SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_insert ON comments;
CREATE TRIGGER on_comment_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_comment_insert();

DROP TRIGGER IF EXISTS on_comment_delete ON comments;
CREATE TRIGGER on_comment_delete
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_comment_delete();

-- ============================================================
-- 3. Fork 触发器 — 自动更新 forks_count
-- ============================================================

CREATE OR REPLACE FUNCTION handle_fork_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.forked_from IS NOT NULL THEN
    UPDATE visualizations SET forks_count = forks_count + 1 WHERE id = NEW.forked_from;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_fork_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.forked_from IS NOT NULL THEN
    UPDATE visualizations SET forks_count = GREATEST(forks_count - 1, 0) WHERE id = OLD.forked_from;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_fork_insert ON visualizations;
CREATE TRIGGER on_fork_insert
  AFTER INSERT ON visualizations
  FOR EACH ROW EXECUTE FUNCTION handle_fork_insert();

DROP TRIGGER IF EXISTS on_fork_delete ON visualizations;
CREATE TRIGGER on_fork_delete
  AFTER DELETE ON visualizations
  FOR EACH ROW EXECUTE FUNCTION handle_fork_delete();

-- ============================================================
-- 4. 浏览量 RPC — 非作者也能调用
-- ============================================================

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
  END IF;
END;
$$;

-- 允许匿名和认证用户调用
GRANT EXECUTE ON FUNCTION increment_views(TEXT, UUID) TO anon, authenticated;
