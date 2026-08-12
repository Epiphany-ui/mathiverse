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
