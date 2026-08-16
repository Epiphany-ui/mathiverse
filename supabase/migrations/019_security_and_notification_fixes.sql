-- supabase/migrations/019_security_and_notification_fixes.sql
--
-- Closes several authorization / data-integrity gaps found during review:
--   1. manim_examples had no RLS at all (anon read AND write of the RAG store)
--   2. wiki_edges INSERT/UPDATE policies were open to PUBLIC
--   3. increment_views inflated counters for nonexistent / unpublished rows
--   4. replies produced duplicate notifications when parent author == target
--      author (e.g. replying to your own comment on someone's content)
--   5. users could follow themselves and get a self-notification
--   6. notifications UPDATE policy allowed transferring a notification to
--      another user (no WITH CHECK)

-- ─── 1. manim_examples: public read, service-role write ──────────────
ALTER TABLE manim_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manim_examples_public_read" ON manim_examples;
CREATE POLICY "manim_examples_public_read"
  ON manim_examples FOR SELECT
  USING (true);

-- ─── 2. wiki_edges: remove PUBLIC write policies ─────────────────────
-- service_role bypasses RLS entirely, so these policies only granted
-- anon/authenticated users the ability to modify the knowledge graph.
DROP POLICY IF EXISTS "Allow service insert on wiki_edges" ON wiki_edges;
DROP POLICY IF EXISTS "Allow service update on wiki_edges" ON wiki_edges;

-- ─── 3. increment_views: only count existing, published targets ──────
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
    UPDATE visualizations SET views_count = views_count + 1
    WHERE id = target_id AND is_published = true;
  ELSIF target_type = 'article' THEN
    UPDATE articles SET views_count = views_count + 1
    WHERE id = target_id AND is_published = true;
  ELSIF target_type = 'wiki' THEN
    UPDATE wiki_entries SET views_count = views_count + 1
    WHERE id = target_id AND is_published = true;
  END IF;
END;
$$;

-- ─── 4. Comment notification: no duplicate when replying to yourself ─
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

  -- Also notify the parent comment author (reply notification), unless that
  -- is the same person who already received the content notification above.
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE
      parent_author UUID;
    BEGIN
      SELECT author_id INTO parent_author FROM comments WHERE id = NEW.parent_id;
      IF parent_author IS NOT NULL
         AND parent_author != NEW.author_id
         AND parent_author IS DISTINCT FROM target_user THEN
        INSERT INTO notifications (user_id, type, actor_id, target_type, target_id)
        VALUES (parent_author, 'comment', NEW.author_id, 'comment', NEW.id);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Follow: forbid self-follows at the database level ────────────
-- NOT VALID keeps the migration fast and safe for existing data; new rows
-- are always checked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follows_no_self_follow'
  ) THEN
    ALTER TABLE follows
      ADD CONSTRAINT follows_no_self_follow
      CHECK (follower_id <> following_id) NOT VALID;
  END IF;
END;
$$;

-- ─── 6. Notifications: keep ownership on UPDATE ─────────────────────
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 7. Delete cleanup: no orphaned likes/bookmarks/comments/notifications ─
-- Deleting a visualization/article/wiki (e.g. from the admin panel) previously
-- left polymorphic likes/bookmarks/comments/notifications pointing at nothing.
CREATE OR REPLACE FUNCTION cleanup_visualization_relations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM likes WHERE target_type = 'visualization' AND target_id = OLD.id;
  DELETE FROM bookmarks WHERE target_type = 'visualization' AND target_id = OLD.id;
  DELETE FROM comments WHERE target_type = 'visualization' AND target_id = OLD.id;
  DELETE FROM notifications WHERE target_type = 'visualization' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_visualization_delete ON visualizations;
CREATE TRIGGER on_visualization_delete AFTER DELETE ON visualizations
  FOR EACH ROW EXECUTE FUNCTION cleanup_visualization_relations();

CREATE OR REPLACE FUNCTION cleanup_article_relations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM likes WHERE target_type = 'article' AND target_id = OLD.id;
  DELETE FROM bookmarks WHERE target_type = 'article' AND target_id = OLD.id;
  DELETE FROM comments WHERE target_type = 'article' AND target_id = OLD.id;
  DELETE FROM notifications WHERE target_type = 'article' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_article_delete ON articles;
CREATE TRIGGER on_article_delete AFTER DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION cleanup_article_relations();

CREATE OR REPLACE FUNCTION cleanup_wiki_relations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM likes WHERE target_type = 'wiki' AND target_id = OLD.id;
  DELETE FROM bookmarks WHERE target_type = 'wiki' AND target_id = OLD.id;
  DELETE FROM comments WHERE target_type = 'wiki' AND target_id = OLD.id;
  DELETE FROM notifications WHERE target_type = 'wiki' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_wiki_entry_delete ON wiki_entries;
CREATE TRIGGER on_wiki_entry_delete AFTER DELETE ON wiki_entries
  FOR EACH ROW EXECUTE FUNCTION cleanup_wiki_relations();

-- Deleting a comment removes its children (no FK exists, so recurse via the
-- trigger) plus likes/notifications that point at it.
CREATE OR REPLACE FUNCTION cleanup_comment_relations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM comments WHERE parent_id = OLD.id;
  DELETE FROM likes WHERE target_type = 'comment' AND target_id = OLD.id;
  DELETE FROM notifications WHERE target_type = 'comment' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_comment_delete_cascade ON comments;
CREATE TRIGGER on_comment_delete_cascade AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION cleanup_comment_relations();
