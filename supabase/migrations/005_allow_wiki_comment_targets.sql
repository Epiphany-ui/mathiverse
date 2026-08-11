-- Allow comments to target wiki entries, matching the application boundary.
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('visualization', 'article', 'wiki'));
