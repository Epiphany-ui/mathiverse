-- supabase/migrations/001_enable_pgvector.sql
-- Enable pgvector extension and create examples table

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE manim_examples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text NOT NULL,
  code          text NOT NULL,
  tags          text[] DEFAULT '{}',
  difficulty    smallint DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  source        text DEFAULT 'manual',
  embedding     vector(1024),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX manim_examples_embedding_idx
  ON manim_examples
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Cosine similarity search RPC
CREATE OR REPLACE FUNCTION match_manim_examples(
  query_embedding vector(1024),
  match_count int DEFAULT 3
) RETURNS TABLE (
  id uuid,
  title text,
  description text,
  code text,
  tags text[],
  difficulty smallint,
  similarity float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.code,
    e.tags,
    e.difficulty,
    (1 - (e.embedding <=> query_embedding)) AS similarity
  FROM manim_examples e
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
