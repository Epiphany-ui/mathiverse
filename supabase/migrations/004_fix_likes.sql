-- Allow "wiki" as a valid likes target_type
ALTER TABLE likes DROP CONSTRAINT IF EXISTS target_type_check;
ALTER TABLE likes ADD CONSTRAINT target_type_check
  CHECK (target_type IN ('visualization', 'article', 'comment', 'wiki'));

-- Also fix bookmarks
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS target_type_check;
ALTER TABLE bookmarks ADD CONSTRAINT target_type_check
  CHECK (target_type IN ('visualization', 'article', 'wiki'));
