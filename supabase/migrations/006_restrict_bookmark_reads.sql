-- Bookmarks are private user activity. Restrict reads to the owner.
DROP POLICY IF EXISTS "bookmarks_read_all" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_read_own" ON bookmarks;

CREATE POLICY "bookmarks_read_own"
  ON bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);
