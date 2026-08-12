-- ============================================================
-- Migration 016: Notifications table + triggers + RLS
-- ============================================================
-- Extracted from supabase-migration-3.sql (legacy root file).
-- Handles both fresh DB bootstrap and existing-table upgrade.
--
-- Changes from the legacy version:
--   - target_type CHECK now includes 'wiki'
--   - All policies use DROP IF EXISTS before CREATE
--   - Trigger functions use CREATE OR REPLACE

-- 1. Notifications table (skip if exists, alter if already present)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'fork')),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('visualization', 'article', 'comment', 'wiki')),
  target_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If table already exists without 'wiki' in the CHECK, fix it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'notifications' AND constraint_name LIKE '%target_type_check%'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_target_type_check
      CHECK (target_type IN ('visualization', 'article', 'comment', 'wiki'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. Triggers — auto-create notifications on social actions
-- ============================================================

-- Like notification (don't notify self-like)
CREATE OR REPLACE FUNCTION on_like_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NEW.target_type = 'visualization' THEN
    SELECT author_id INTO target_user FROM visualizations WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    SELECT author_id INTO target_user FROM articles WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT author_id INTO target_user FROM comments WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'wiki' THEN
    SELECT author_id INTO target_user FROM wiki_entries WHERE id = NEW.target_id;
  END IF;

  IF target_user IS NOT NULL AND target_user != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
    VALUES (target_user, 'like', NEW.user_id, NEW.target_type, NEW.target_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_notify ON likes;
CREATE TRIGGER on_like_notify AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION on_like_notify();

-- Comment notification
CREATE OR REPLACE FUNCTION on_comment_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NEW.target_type = 'visualization' THEN
    SELECT author_id INTO target_user FROM visualizations WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'article' THEN
    SELECT author_id INTO target_user FROM articles WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'wiki' THEN
    SELECT author_id INTO target_user FROM wiki_entries WHERE id = NEW.target_id;
  END IF;

  IF target_user IS NOT NULL AND target_user != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
    VALUES (target_user, 'comment', NEW.author_id, NEW.target_type, NEW.target_id);
  END IF;

  -- Also notify the parent comment author (reply notification)
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE
      parent_author UUID;
    BEGIN
      SELECT author_id INTO parent_author FROM comments WHERE id = NEW.parent_id;
      IF parent_author IS NOT NULL AND parent_author != NEW.author_id THEN
        INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
        VALUES (parent_author, 'comment', NEW.author_id, 'comment', NEW.id);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_notify ON comments;
CREATE TRIGGER on_comment_notify AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION on_comment_notify();

-- Follow notification
CREATE OR REPLACE FUNCTION on_follow_notify()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_notify ON follows;
CREATE TRIGGER on_follow_notify AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_notify();

-- Fork notification
CREATE OR REPLACE FUNCTION on_fork_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  IF NEW.forked_from IS NOT NULL THEN
    SELECT author_id INTO target_user FROM visualizations WHERE id = NEW.forked_from;
    IF target_user IS NOT NULL AND target_user != NEW.author_id THEN
      INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
      VALUES (target_user, 'fork', NEW.author_id, 'visualization', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_fork_notify ON visualizations;
CREATE TRIGGER on_fork_notify AFTER INSERT ON visualizations
  FOR EACH ROW EXECUTE FUNCTION on_fork_notify();
