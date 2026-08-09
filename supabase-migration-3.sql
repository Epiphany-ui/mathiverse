-- ============================================================
-- Mathiverse Migration 3: Notifications System
-- 复制到 Supabase SQL Editor 执行
-- ============================================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'fork')),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('visualization', 'article', 'comment')),
  target_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- RLS: 用户只能看自己的通知
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. Triggers — auto-create notifications on social actions
-- ============================================================

-- Like notification (don't notify self-like)
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_owner UUID;
BEGIN
  -- Find the owner of the liked content
  IF NEW.target_type = 'visualization' THEN
    SELECT author_id INTO target_owner FROM visualizations WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    SELECT author_id INTO target_owner FROM articles WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT author_id INTO target_owner FROM comments WHERE id = NEW.target_id;
  END IF;

  -- Don't notify if user likes their own content
  IF target_owner IS NOT NULL AND target_owner != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
    VALUES (target_owner, 'like', NEW.user_id, NEW.target_type, NEW.target_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_like_notify ON likes;
CREATE TRIGGER on_like_notify
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- Comment notification
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_owner UUID;
BEGIN
  -- Find the owner of the commented content
  IF NEW.target_type = 'visualization' THEN
    SELECT author_id INTO target_owner FROM visualizations WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    SELECT author_id INTO target_owner FROM articles WHERE id = NEW.target_id;
  END IF;

  -- Notify content owner (if not self-comment)
  IF target_owner IS NOT NULL AND target_owner != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
    VALUES (target_owner, 'comment', NEW.author_id, NEW.target_type, NEW.target_id);
  END IF;

  -- If it's a reply, also notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE
      parent_author UUID;
    BEGIN
      SELECT author_id INTO parent_author FROM comments WHERE id = NEW.parent_id;
      IF parent_author IS NOT NULL AND parent_author != NEW.author_id AND parent_author != target_owner THEN
        INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
        VALUES (parent_author, 'comment', NEW.author_id, 'comment', NEW.id);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_notify ON comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- Follow notification
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_notify ON follows;
CREATE TRIGGER on_follow_notify
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- Fork notification
CREATE OR REPLACE FUNCTION notify_on_fork()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.forked_from IS NOT NULL THEN
    DECLARE
      original_author UUID;
    BEGIN
      SELECT author_id INTO original_author FROM visualizations WHERE id = NEW.forked_from;
      IF original_author IS NOT NULL AND original_author != NEW.author_id THEN
        INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
        VALUES (original_author, 'fork', NEW.author_id, 'visualization', NEW.id);
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_fork_notify ON visualizations;
CREATE TRIGGER on_fork_notify
  AFTER INSERT ON visualizations
  FOR EACH ROW EXECUTE FUNCTION notify_on_fork();
