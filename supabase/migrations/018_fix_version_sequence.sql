-- Make generation_versions.sequence per-job instead of global auto-increment.
-- Previously GENERATED ALWAYS AS IDENTITY produced gaps between versions of the
-- same job (e.g. V1, V2, V5, V9) because the counter was shared across all jobs.
--
-- Idempotent: safe to re-run. Each step detects whether work is already done.

-- 1. Drop the global identity so we can assign our own values.
--    (Skips silently if the identity was already dropped.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'generation_versions'
      AND a.attname = 'sequence'
      AND a.attidentity <> ''
  ) THEN
    ALTER TABLE generation_versions ALTER COLUMN sequence DROP IDENTITY;
  END IF;
END
$$;

-- 2. Default safety net: rows inserted without an explicit sequence still
--    get a value instead of failing.
CREATE SEQUENCE IF NOT EXISTS generation_versions_seq;
ALTER TABLE generation_versions ALTER COLUMN sequence SET DEFAULT nextval('generation_versions_seq');

-- Keep the safety-net sequence ahead of existing values so it can never
-- collide with a (job_id, sequence) unique pair.
SELECT setval(
  'generation_versions_seq',
  GREATEST((SELECT COALESCE(MAX(sequence), 0) FROM generation_versions), 1),
  EXISTS (SELECT 1 FROM generation_versions)
);

-- 3. Renumber existing versions so every job starts at 1 with no gaps.
WITH numbered AS (
  SELECT id, job_id,
         ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at, sequence) AS new_seq
  FROM generation_versions
)
UPDATE generation_versions v
SET sequence = n.new_seq
FROM numbered n
WHERE v.id = n.id;
