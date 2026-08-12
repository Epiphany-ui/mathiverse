-- Migration 013: Fix wiki_entries.author_id FK — point to profiles instead of auth.users
-- Migration 007 created the FK referencing auth.users(id), but PostgREST join hints
-- (profiles!author_id) require a FK to public.profiles.  The profiles!author_id hint is
-- used by getWikiEntryBySlug, getWikiEntryById, and knowledge-graph fallback queries.

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'wiki_entries'
    AND kcu.column_name = 'author_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE wiki_entries DROP CONSTRAINT ' || fk_name;
  END IF;
END $$;

ALTER TABLE wiki_entries
  ADD CONSTRAINT wiki_entries_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
