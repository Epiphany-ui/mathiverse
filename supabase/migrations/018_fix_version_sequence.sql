-- Make generation_versions.sequence per-job instead of global auto-increment.
-- Previously GENERATED ALWAYS AS IDENTITY produced gaps between versions of the
-- same job (e.g. V1, V2, V5, V9) because the counter was shared across all jobs.

-- 1. Drop the global identity so we can assign our own values
ALTER TABLE generation_versions ALTER COLUMN sequence DROP IDENTITY;

-- Add a default as safety net (new rows without an explicit sequence get the
-- old global behaviour via a simple auto-increment)
CREATE SEQUENCE IF NOT EXISTS generation_versions_seq;
ALTER TABLE generation_versions ALTER COLUMN sequence SET DEFAULT nextval('generation_versions_seq');

-- 2. Renumber existing versions so every job starts at 1 with no gaps
WITH numbered AS (
  SELECT id, job_id,
         ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at, sequence) AS new_seq
  FROM generation_versions
)
UPDATE generation_versions v
SET sequence = n.new_seq
FROM numbered n
WHERE v.id = n.id;
