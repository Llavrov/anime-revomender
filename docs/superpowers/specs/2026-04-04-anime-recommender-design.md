# Anime Recommender — Design Spec

## Overview

Personal anime recommendation service with swipe-based discovery, catalog with filters, and content-based recommendation engine. Single user (lionarr), data sourced from Shikimori API.

**Deploy:** Vercel  
**Stack:** Next.js 14 (App Router) + Supabase (PostgreSQL) + Shikimori API  
**Shikimori user:** lionarr (id: 1433642)

## Architecture

Three layers in a single Next.js project:

1. **Data layer** — npm scripts (`seed`, `sync`) that fetch top-2000 anime and user rates from Shikimori API, store in Supabase.
2. **Recommendation engine** — content-based scoring computed on the fly from user rates and anime metadata.
3. **Web UI** — swipe interface, catalog with filters, personal list management.

## Data Model

### Tables

```sql
-- Anime catalog (Shikimori as source of truth)
anime (
  id            int PRIMARY KEY,        -- Shikimori ID
  name          text NOT NULL,          -- original title
  russian       text,                   -- russian title
  kind          text NOT NULL,          -- tv/movie/ova/ona/special
  score         float,                  -- Shikimori community rating
  status        text NOT NULL,          -- released/ongoing/anons
  episodes      int,
  aired_on      date,
  released_on   date,
  rating        text,                   -- pg_13, r, etc.
  duration      int,                    -- minutes per episode
  description   text,
  image_url     text,
  franchise     text,                   -- groups seasons together
  shikimori_url text,
  fetched_at    timestamptz DEFAULT now()
)

-- Genre dictionary
genres (
  id      int PRIMARY KEY,             -- Shikimori ID
  name    text NOT NULL,
  russian text
)

-- Many-to-many: anime <-> genres
anime_genres (
  anime_id int REFERENCES anime(id),
  genre_id int REFERENCES genres(id),
  PRIMARY KEY (anime_id, genre_id)
)

-- Studio dictionary
studios (
  id        int PRIMARY KEY,
  name      text NOT NULL,
  image_url text
)

-- Many-to-many: anime <-> studios
anime_studios (
  anime_id  int REFERENCES anime(id),
  studio_id int REFERENCES studios(id),
  PRIMARY KEY (anime_id, studio_id)
)

-- User ratings (single user, no users table)
user_rates (
  id         serial PRIMARY KEY,
  anime_id   int REFERENCES anime(id) UNIQUE,
  status     text,                     -- completed/watching/planned/on_hold/dropped
  score      int DEFAULT 0,            -- 0-10
  reaction   text,                     -- like/dislike/skip (from swipes)
  source     text DEFAULT 'manual',    -- shikimori_import/manual
  updated_at timestamptz DEFAULT now()
)
```

## Recommendation Engine

### Content-based scoring

For each unrated anime, compute:

```
recommendation_score =
    genre_affinity   * 0.40
  + studio_affinity  * 0.15
  + kind_affinity    * 0.10
  + shikimori_score  * 0.20
  + franchise_bonus  * 0.15
```

### Genre affinity (main signal)

Build a weighted genre vector from user rates:
- Each rated anime contributes its score to the genres it belongs to
- Example: Vinland Saga (10) -> Action +10, Drama +10, Adventure +10
- Normalize the vector to [0, 1] range
- Score each candidate anime by dot product with this vector

### Swipe feedback updates

- **Like** = +8 to genre weights of that anime
- **Dislike** = -3 to genre weights (softer to avoid over-correction)
- **Skip** = ignored

### Studio affinity

Same approach as genres but with studios. Lower weight because studio preference is weaker signal.

### Kind affinity

Track which types (TV/Movie/OVA) the user rates highest on average.

### Franchise bonus

If the user rated another season from the same franchise >= 8, add bonus. Helps surface unwatched sequels.

### LLM layer (phase 2)

Top-20 candidates by score -> send to Claude API with user taste profile -> get re-ranking + text explanations ("you'll like this because..."). Triggered by button press, not automatic (save tokens).

## Web UI

### Screens

**1. Swipe (home)**
- Full-screen anime card: poster, title, genres, Shikimori rating, short description
- Three buttons: Dislike / Skip / Like
- Shows top recommendations the user hasn't rated yet
- Swipe gestures on mobile

**2. Catalog**
- Grid of anime cards
- Filters: genres (multi-select), type, year range, Shikimori rating range, status
- Sort: by recommendation score / by rating / by year
- Click card -> detail page with full description, screenshots, Shikimori link

**3. My List**
- Tabs: Completed / Watching / Planned / On Hold / Dropped
- Imported from Shikimori + manual additions
- Edit score and status inline

### Navigation

Bottom tab bar: Swipe / Catalog / My List

### Style

- Dark theme
- Mobile-first, responsive for desktop
- Posters as primary visual element
- Minimalist, clean

## Data Pipeline

### Initial seed (`npm run seed`)

1. `GET /api/genres` -> populate `genres` table
2. `GET /api/animes?order=ranked&limit=50&page=1..40` -> top-2000 anime -> `anime`, `anime_genres`, `anime_studios`
3. `GET /api/users/1433642/anime_rates?limit=50&page=1..N` -> import into `user_rates` with `source=shikimori_import`
4. Rate limit: 5 req/sec, ~2000 items in ~8 minutes

### Sync (`npm run sync`)

- Re-run manually when catalog or Shikimori rates need updating
- Upsert by Shikimori ID (no duplicates)

### Recommendation recompute

- Computed on the fly on each request (fast enough for ~2000 anime)
- No pre-computed column needed
