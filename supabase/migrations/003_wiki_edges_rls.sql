-- Enable RLS read access on wiki_edges for authenticated and anon users
ALTER TABLE wiki_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on wiki_edges"
  ON wiki_edges FOR SELECT
  USING (true);

CREATE POLICY "Allow service insert on wiki_edges"
  ON wiki_edges FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service update on wiki_edges"
  ON wiki_edges FOR UPDATE
  USING (true);
