-- ============================================================
-- Migration 015: Fix wiki_entries RLS
-- ============================================================
-- Migration 002 created only "wiki_read_published" (SELECT on is_published),
-- leaving wiki_entries without INSERT/UPDATE policies and with no admin
-- exception for reading unpublished drafts.
--
-- Fixes:
--   1. INSERT policy for authenticated users (author_id must equal auth.uid()),
--      mirroring viz_insert_auth / articles_insert_auth from supabase-migration.sql.
--   2. SELECT policy extended with author + admin/owner exceptions so authors
--      and admins can read unpublished drafts.
--   3. UPDATE policy for the author to edit their own entries, mirroring
--      viz_update_own / articles_update_own.
--
-- Counter columns (likes_count, comments_count, views_count) are maintained by
-- SECURITY DEFINER triggers/RPCs (handle_like_insert, handle_comment_insert,
-- increment_views from migration 002), which bypass RLS — no policy needed.
-- Admin CMS writes/deletes (admin/wiki/[slug], admin/wiki-list) use the
-- service-role admin client, which bypasses RLS entirely, so no admin
-- exception is needed on INSERT/UPDATE.

-- ============================================================
-- 1. SELECT — published to everyone; author + admin/owner read drafts
-- ============================================================
-- The author exception is required: POST /api/wiki falls back to the
-- user-scoped client when no admin client is configured, and createWikiEntry
-- inserts with is_published = false then reads the row back via
-- .select("*").single() — PostgREST needs a SELECT policy matching the new
-- row for that read-back to succeed.
--
-- The admin EXISTS subquery re-uses the exact pattern from
-- 014_audit_log_rls.sql. It is safe: RLS recursion (42P17, see 012) only
-- occurs when a policy subquery re-enters RLS on the same table (or in a
-- mutual cross-table cycle). profiles policies do not reference
-- wiki_entries, so no cycle exists here. We deliberately keep profiles
-- subqueries OUT of WITH CHECK clauses, which is where the 012 incident
-- showed them to be fragile.

DROP POLICY IF EXISTS wiki_read_published ON wiki_entries;

CREATE POLICY wiki_read_published ON wiki_entries FOR SELECT
  USING (
    is_published = true
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================================
-- 2. INSERT — authenticated users may create entries as themselves
-- ============================================================
-- Mirrors viz_insert_auth / articles_insert_auth. Admin/seed inserts go
-- through the service-role client (bypasses RLS), so author_id there may
-- be NULL without a policy exception.
DROP POLICY IF EXISTS wiki_insert_auth ON wiki_entries;
CREATE POLICY wiki_insert_auth ON wiki_entries FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- ============================================================
-- 3. UPDATE — authors may edit their own entries
-- ============================================================
-- WITH CHECK (auth.uid() = author_id) additionally prevents an author from
-- reassigning the row to another user or nulling author_id (matching the
-- no-privilege-escalation stance of migration 012).
DROP POLICY IF EXISTS wiki_update_own ON wiki_entries;
CREATE POLICY wiki_update_own ON wiki_entries FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);
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
-- ============================================================
-- Migration 017: Fix username collision in handle_new_user trigger
-- ============================================================
-- The handle_new_user AFTER INSERT trigger has no EXCEPTION handling.
-- A duplicate username (on GitHub OAuth signup if the username is taken,
-- or any registration where COALESCE-generated usernames collide) raises
-- a unique-violation error that rolls back the entire auth.users INSERT,
-- causing a cryptic signup failure with no user feedback.
--
-- Fix: on unique violation, append a random suffix and retry once.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    base_username,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
    -- Retry with a random suffix to avoid the collision
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      NEW.id,
      base_username || '_' || substring(md5(random()::text) from 1 for 6),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
      NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
