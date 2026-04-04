CREATE TABLE anime (
  id            int PRIMARY KEY,
  name          text NOT NULL,
  russian       text,
  kind          text NOT NULL,
  score         float,
  status        text NOT NULL,
  episodes      int,
  aired_on      date,
  released_on   date,
  rating        text,
  duration      int,
  description   text,
  image_url     text,
  franchise     text,
  shikimori_url text,
  fetched_at    timestamptz DEFAULT now()
);

CREATE TABLE genres (
  id      int PRIMARY KEY,
  name    text NOT NULL,
  russian text
);

CREATE TABLE anime_genres (
  anime_id int REFERENCES anime(id) ON DELETE CASCADE,
  genre_id int REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, genre_id)
);

CREATE TABLE studios (
  id        int PRIMARY KEY,
  name      text NOT NULL,
  image_url text
);

CREATE TABLE anime_studios (
  anime_id  int REFERENCES anime(id) ON DELETE CASCADE,
  studio_id int REFERENCES studios(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, studio_id)
);

CREATE TABLE user_rates (
  id         serial PRIMARY KEY,
  anime_id   int REFERENCES anime(id) ON DELETE CASCADE UNIQUE,
  status     text,
  score      int DEFAULT 0,
  reaction   text,
  source     text DEFAULT 'manual',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_anime_kind ON anime(kind);
CREATE INDEX idx_anime_status ON anime(status);
CREATE INDEX idx_anime_score ON anime(score);
CREATE INDEX idx_anime_franchise ON anime(franchise);
CREATE INDEX idx_user_rates_anime_id ON user_rates(anime_id);
CREATE INDEX idx_user_rates_status ON user_rates(status);
CREATE INDEX idx_user_rates_reaction ON user_rates(reaction);
