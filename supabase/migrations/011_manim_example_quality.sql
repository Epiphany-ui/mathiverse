ALTER TABLE manim_examples
  ADD COLUMN IF NOT EXISTS dimension text NOT NULL DEFAULT '2d'
    CHECK (dimension IN ('2d', '3d', 'formula', 'mixed')),
  ADD COLUMN IF NOT EXISTS manim_version text NOT NULL DEFAULT '0.20.1',
  ADD COLUMN IF NOT EXISTS render_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS render_hash text;

CREATE OR REPLACE FUNCTION match_verified_manim_examples(
  query_embedding vector(1024), match_count int DEFAULT 3,
  match_threshold float DEFAULT 0.72, dimension_filter text DEFAULT NULL,
  max_difficulty smallint DEFAULT 3, manim_version_filter text DEFAULT '0.20.1'
) RETURNS TABLE (
  id uuid, title text, description text, code text, tags text[],
  difficulty smallint, source text, dimension text, manim_version text,
  render_verified boolean, render_hash text, similarity float
) LANGUAGE sql STABLE AS $$
  SELECT e.id, e.title, e.description, e.code, e.tags, e.difficulty,
         e.source, e.dimension, e.manim_version, e.render_verified,
         e.render_hash, 1 - (e.embedding <=> query_embedding) AS similarity
  FROM manim_examples e
  WHERE e.render_verified = true AND e.embedding IS NOT NULL
    AND e.difficulty <= max_difficulty
    AND e.manim_version = manim_version_filter
    AND (dimension_filter IS NULL OR e.dimension = dimension_filter)
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
  ORDER BY e.embedding <=> query_embedding LIMIT match_count;
$$;
