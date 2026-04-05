CREATE TABLE IF NOT EXISTS recommendation_scores (
  anime_id INTEGER PRIMARY KEY REFERENCES anime(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recommendation_scores DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rec_scores_score ON recommendation_scores(score DESC);
