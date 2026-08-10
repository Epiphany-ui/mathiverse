-- supabase/migrations/002_wiki_edges.sql
-- Knowledge graph edges between wiki entries

CREATE TABLE wiki_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  label       text NOT NULL,
  strength    float NOT NULL DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(source_id, target_id)
);

CREATE INDEX idx_wiki_edges_source ON wiki_edges(source_id);
CREATE INDEX idx_wiki_edges_target ON wiki_edges(target_id);
