# Anime Recommender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal anime recommendation service with swipe-based discovery, filterable catalog, and content-based recommendation engine powered by Shikimori data.

**Architecture:** Next.js 14 App Router with Supabase PostgreSQL. Data seeded from Shikimori API (top-2000 anime + user rates for lionarr). Recommendation engine computes scores on the fly using genre/studio/kind affinity from user ratings and swipe feedback.

**Tech Stack:** Next.js 14, TypeScript, Supabase (PostgreSQL + JS client), Tailwind CSS, Shikimori API

---

## File Structure

```
anime-recommender/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 -- Root layout, dark theme, bottom nav
│   │   ├── globals.css                -- Tailwind + dark theme vars
│   │   ├── page.tsx                   -- Swipe screen (home)
│   │   ├── catalog/
│   │   │   ├── page.tsx               -- Catalog grid with filters
│   │   │   └── [id]/
│   │   │       └── page.tsx           -- Anime detail page
│   │   └── my-list/
│   │       └── page.tsx               -- My list with tabs
│   ├── components/
│   │   ├── anime-card.tsx             -- Card for catalog grid
│   │   ├── swipe-card.tsx             -- Full-screen swipe card
│   │   ├── bottom-nav.tsx             -- Bottom tab bar
│   │   ├── filter-bar.tsx             -- Catalog filters
│   │   └── rate-editor.tsx            -- Inline score/status editor
│   ├── lib/
│   │   ├── supabase.ts               -- Supabase client singleton
│   │   ├── recommendation.ts          -- Scoring algorithm
│   │   └── types.ts                   -- Shared types
│   └── actions/
│       ├── swipe.ts                   -- Server action: record swipe
│       ├── rate.ts                    -- Server action: update rate
│       └── recommend.ts              -- Server action: get recommendations
├── scripts/
│   ├── seed.ts                        -- Fetch genres + top-2000 anime + user rates
│   └── sync.ts                        -- Re-fetch and upsert
├── supabase/
│   └── migrations/
│       └── 001_init.sql               -- All tables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── .env.local                         -- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Task 1: Project Setup + Supabase Schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `supabase/migrations/001_init.sql`
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`
- Create: `.env.local`

- [ ] **Step 1: Init Next.js project**

```bash
cd /Users/levlavrov/WebstormProjects/anime-recommender
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

- [ ] **Step 2: Install Supabase client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 3: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SHIKIMORI_USER_ID=1433642
```

User must create a Supabase project at https://supabase.com and paste the URL + anon key.

- [ ] **Step 4: Create Supabase migration**

Create `supabase/migrations/001_init.sql`:

```sql
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
```

- [ ] **Step 5: Run migration in Supabase**

Go to Supabase Dashboard -> SQL Editor -> paste and run `001_init.sql`.

- [ ] **Step 6: Create Supabase client**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- [ ] **Step 7: Create shared types**

Create `src/lib/types.ts`:

```typescript
export type AnimeKind = "tv" | "movie" | "ova" | "ona" | "special";
export type AnimeStatus = "released" | "ongoing" | "anons";
export type UserRateStatus = "completed" | "watching" | "planned" | "on_hold" | "dropped";
export type Reaction = "like" | "dislike" | "skip";

export type Anime = {
  id: number;
  name: string;
  russian: string | null;
  kind: AnimeKind;
  score: number | null;
  status: AnimeStatus;
  episodes: number | null;
  aired_on: string | null;
  released_on: string | null;
  rating: string | null;
  duration: number | null;
  description: string | null;
  image_url: string | null;
  franchise: string | null;
  shikimori_url: string | null;
  fetched_at: string;
};

export type Genre = {
  id: number;
  name: string;
  russian: string | null;
};

export type Studio = {
  id: number;
  name: string;
  image_url: string | null;
};

export type UserRate = {
  id: number;
  anime_id: number;
  status: UserRateStatus | null;
  score: number;
  reaction: Reaction | null;
  source: string;
  updated_at: string;
};

export type AnimeWithRelations = Anime & {
  genres: Genre[];
  studios: Studio[];
  user_rate: UserRate | null;
};

export type RecommendedAnime = AnimeWithRelations & {
  recommendation_score: number;
};
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: project setup with Supabase schema and types"
```

---

## Task 2: Seed Script — Shikimori API Data Import

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json` (add seed script)

- [ ] **Step 1: Install tsx for running TypeScript scripts**

```bash
npm install -D tsx
```

- [ ] **Step 2: Add seed script to package.json**

Add to `scripts` in `package.json`:

```json
"seed": "tsx scripts/seed.ts",
"sync": "tsx scripts/sync.ts"
```

- [ ] **Step 3: Create seed script**

Create `scripts/seed.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHIKIMORI_BASE = "https://shikimori.one/api";
const USER_AGENT = "anime-recommender/1.0";
const RATE_LIMIT_MS = 220; // ~4.5 req/sec to stay under 5/sec
const SHIKIMORI_USER_ID = 1433642;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchShikimori<T>(path: string): Promise<T> {
  await sleep(RATE_LIMIT_MS);
  const res = await fetch(`${SHIKIMORI_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Shikimori ${path}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

type ShikimoriGenre = {
  id: number;
  name: string;
  russian: string;
  kind: string; // "anime" | "manga"
};

type ShikimoriStudio = {
  id: number;
  name: string;
  image: string | null;
};

type ShikimoriAnime = {
  id: number;
  name: string;
  russian: string | null;
  kind: string;
  score: string;
  status: string;
  episodes: number;
  episodes_aired: number;
  aired_on: string | null;
  released_on: string | null;
  rating: string | null;
  duration: number;
  description: string | null;
  image: { original: string; preview: string };
  franchise: string | null;
  url: string;
  genres: ShikimoriGenre[];
  studios: ShikimoriStudio[];
};

type ShikimoriAnimeListItem = {
  id: number;
  name: string;
  russian: string | null;
  kind: string;
  score: string;
  status: string;
  episodes: number;
  episodes_aired: number;
  aired_on: string | null;
  released_on: string | null;
  image: { original: string };
  url: string;
};

type ShikimoriRate = {
  id: number;
  score: number;
  status: string;
  episodes: number;
  anime: ShikimoriAnimeListItem;
};

async function seedGenres() {
  console.log("Fetching genres...");
  const genres = await fetchShikimori<ShikimoriGenre[]>("/genres");
  const animeGenres = genres.filter((g) => g.kind === "anime");

  const { error } = await supabase.from("genres").upsert(
    animeGenres.map((g) => ({ id: g.id, name: g.name, russian: g.russian }))
  );
  if (error) throw error;
  console.log(`Seeded ${animeGenres.length} genres`);
}

async function seedAnime() {
  console.log("Fetching top-2000 anime...");
  let total = 0;

  for (let page = 1; page <= 40; page++) {
    const animeList = await fetchShikimori<ShikimoriAnimeListItem[]>(
      `/animes?order=ranked&limit=50&page=${page}`
    );
    if (animeList.length === 0) break;

    // Fetch full details for each anime (need genres + studios)
    for (const item of animeList) {
      const anime = await fetchShikimori<ShikimoriAnime>(`/animes/${item.id}`);

      // Upsert anime
      const { error: animeErr } = await supabase.from("anime").upsert({
        id: anime.id,
        name: anime.name,
        russian: anime.russian,
        kind: anime.kind,
        score: parseFloat(anime.score) || null,
        status: anime.status,
        episodes: anime.episodes || anime.episodes_aired || null,
        aired_on: anime.aired_on || null,
        released_on: anime.released_on || null,
        rating: anime.rating,
        duration: anime.duration || null,
        description: anime.description,
        image_url: `https://shikimori.one${anime.image.original}`,
        franchise: anime.franchise,
        shikimori_url: `https://shikimori.one${anime.url}`,
        fetched_at: new Date().toISOString(),
      });
      if (animeErr) throw animeErr;

      // Upsert studios
      for (const studio of anime.studios) {
        await supabase.from("studios").upsert({
          id: studio.id,
          name: studio.name,
          image_url: studio.image,
        });
        await supabase.from("anime_studios").upsert({
          anime_id: anime.id,
          studio_id: studio.id,
        });
      }

      // Upsert anime_genres
      for (const genre of anime.genres.filter((g) => g.kind === "anime")) {
        await supabase.from("anime_genres").upsert({
          anime_id: anime.id,
          genre_id: genre.id,
        });
      }

      total++;
    }

    console.log(`Page ${page}/40 done (${total} anime total)`);
  }

  console.log(`Seeded ${total} anime`);
}

async function seedUserRates() {
  console.log("Fetching user rates...");
  let page = 1;
  let total = 0;

  while (true) {
    const rates = await fetchShikimori<ShikimoriRate[]>(
      `/users/${SHIKIMORI_USER_ID}/anime_rates?limit=50&page=${page}`
    );
    if (rates.length === 0) break;

    for (const rate of rates) {
      // Check if anime exists in our DB
      const { data: existing } = await supabase
        .from("anime")
        .select("id")
        .eq("id", rate.anime.id)
        .single();

      // If anime not in DB yet, fetch and insert it
      if (!existing) {
        const anime = await fetchShikimori<ShikimoriAnime>(`/animes/${rate.anime.id}`);
        await supabase.from("anime").upsert({
          id: anime.id,
          name: anime.name,
          russian: anime.russian,
          kind: anime.kind,
          score: parseFloat(anime.score) || null,
          status: anime.status,
          episodes: anime.episodes || anime.episodes_aired || null,
          aired_on: anime.aired_on || null,
          released_on: anime.released_on || null,
          rating: anime.rating,
          duration: anime.duration || null,
          description: anime.description,
          image_url: `https://shikimori.one${anime.image.original}`,
          franchise: anime.franchise,
          shikimori_url: `https://shikimori.one${anime.url}`,
          fetched_at: new Date().toISOString(),
        });
        for (const genre of anime.genres.filter((g) => g.kind === "anime")) {
          await supabase.from("anime_genres").upsert({
            anime_id: anime.id,
            genre_id: genre.id,
          });
        }
        for (const studio of anime.studios) {
          await supabase.from("studios").upsert({
            id: studio.id,
            name: studio.name,
            image_url: studio.image,
          });
          await supabase.from("anime_studios").upsert({
            anime_id: anime.id,
            studio_id: studio.id,
          });
        }
      }

      // Upsert user rate
      const { error } = await supabase.from("user_rates").upsert(
        {
          anime_id: rate.anime.id,
          status: rate.status,
          score: rate.score,
          source: "shikimori_import",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "anime_id" }
      );
      if (error) throw error;
      total++;
    }

    page++;
  }

  console.log(`Seeded ${total} user rates`);
}

async function main() {
  console.log("Starting seed...");
  await seedGenres();
  await seedAnime();
  await seedUserRates();
  console.log("Seed complete!");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
```

- [ ] **Step 4: Test seed script with dry run**

First, verify Shikimori API is reachable:

```bash
curl -s -H "User-Agent: anime-recommender/1.0" "https://shikimori.one/api/genres" | head -c 200
```

Expected: JSON array of genres.

- [ ] **Step 5: Run seed**

```bash
npx dotenv-cli -e .env.local -- npm run seed
```

Install dotenv-cli first if needed: `npm install -D dotenv-cli`

Expected: logs showing genres, anime pages, and user rates being imported. Takes ~15-20 minutes due to rate limiting (each anime needs a detail fetch).

- [ ] **Step 6: Verify data in Supabase**

Go to Supabase Dashboard -> Table Editor:
- `anime` should have ~2000 rows
- `genres` should have ~30-40 rows
- `user_rates` should have ~51 rows
- `anime_genres` and `anime_studios` should be populated

- [ ] **Step 7: Commit**

```bash
git add scripts/seed.ts package.json package-lock.json
git commit -m "feat: add Shikimori data seed script"
```

---

## Task 3: Sync Script

**Files:**
- Create: `scripts/sync.ts`

- [ ] **Step 1: Create sync script**

Create `scripts/sync.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHIKIMORI_BASE = "https://shikimori.one/api";
const USER_AGENT = "anime-recommender/1.0";
const RATE_LIMIT_MS = 220;
const SHIKIMORI_USER_ID = 1433642;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchShikimori<T>(path: string): Promise<T> {
  await sleep(RATE_LIMIT_MS);
  const res = await fetch(`${SHIKIMORI_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Shikimori ${path}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

type ShikimoriRate = {
  id: number;
  score: number;
  status: string;
  anime: {
    id: number;
    name: string;
    russian: string | null;
    kind: string;
    score: string;
    status: string;
    episodes: number;
    episodes_aired: number;
    aired_on: string | null;
    released_on: string | null;
    image: { original: string };
    url: string;
  };
};

type ShikimoriAnime = {
  id: number;
  name: string;
  russian: string | null;
  kind: string;
  score: string;
  status: string;
  episodes: number;
  episodes_aired: number;
  aired_on: string | null;
  released_on: string | null;
  rating: string | null;
  duration: number;
  description: string | null;
  image: { original: string };
  franchise: string | null;
  url: string;
  genres: { id: number; name: string; russian: string; kind: string }[];
  studios: { id: number; name: string; image: string | null }[];
};

async function syncUserRates() {
  console.log("Syncing user rates...");
  let page = 1;
  let total = 0;

  while (true) {
    const rates = await fetchShikimori<ShikimoriRate[]>(
      `/users/${SHIKIMORI_USER_ID}/anime_rates?limit=50&page=${page}`
    );
    if (rates.length === 0) break;

    for (const rate of rates) {
      const { data: existing } = await supabase
        .from("anime")
        .select("id")
        .eq("id", rate.anime.id)
        .single();

      if (!existing) {
        const anime = await fetchShikimori<ShikimoriAnime>(`/animes/${rate.anime.id}`);
        await supabase.from("anime").upsert({
          id: anime.id,
          name: anime.name,
          russian: anime.russian,
          kind: anime.kind,
          score: parseFloat(anime.score) || null,
          status: anime.status,
          episodes: anime.episodes || anime.episodes_aired || null,
          aired_on: anime.aired_on || null,
          released_on: anime.released_on || null,
          rating: anime.rating,
          duration: anime.duration || null,
          description: anime.description,
          image_url: `https://shikimori.one${anime.image.original}`,
          franchise: anime.franchise,
          shikimori_url: `https://shikimori.one${anime.url}`,
          fetched_at: new Date().toISOString(),
        });
        for (const genre of anime.genres.filter((g) => g.kind === "anime")) {
          await supabase.from("anime_genres").upsert({
            anime_id: anime.id,
            genre_id: genre.id,
          });
        }
        for (const studio of anime.studios) {
          await supabase.from("studios").upsert({
            id: studio.id,
            name: studio.name,
            image_url: studio.image,
          });
          await supabase.from("anime_studios").upsert({
            anime_id: anime.id,
            studio_id: studio.id,
          });
        }
      }

      await supabase.from("user_rates").upsert(
        {
          anime_id: rate.anime.id,
          status: rate.status,
          score: rate.score,
          source: "shikimori_import",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "anime_id" }
      );
      total++;
    }

    page++;
  }

  console.log(`Synced ${total} user rates`);
}

async function main() {
  await syncUserRates();
  console.log("Sync complete!");
}

main().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sync.ts
git commit -m "feat: add Shikimori sync script"
```

---

## Task 4: Recommendation Engine

**Files:**
- Create: `src/lib/recommendation.ts`

- [ ] **Step 1: Write recommendation engine tests**

Create `src/lib/__tests__/recommendation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  computeRecommendationScore,
} from "../recommendation";
import type { Anime, Genre, UserRate } from "../types";

const mockGenres: Genre[] = [
  { id: 1, name: "Action", russian: "Экшен" },
  { id: 2, name: "Fantasy", russian: "Фэнтези" },
  { id: 3, name: "Romance", russian: "Романтика" },
];

const mockAnimeRated = {
  id: 1,
  name: "Test Anime",
  russian: "Тест",
  kind: "tv" as const,
  score: 8.5,
  status: "released" as const,
  episodes: 24,
  aired_on: null,
  released_on: null,
  rating: null,
  duration: 24,
  description: null,
  image_url: null,
  franchise: "test_franchise",
  shikimori_url: null,
  fetched_at: "",
  genres: [mockGenres[0], mockGenres[1]], // Action, Fantasy
  studios: [{ id: 10, name: "Studio A", image_url: null }],
  user_rate: { id: 1, anime_id: 1, status: "completed" as const, score: 9, reaction: null, source: "shikimori_import", updated_at: "" },
};

const mockAnimeCandidate = {
  id: 2,
  name: "Candidate",
  russian: "Кандидат",
  kind: "tv" as const,
  score: 7.5,
  status: "released" as const,
  episodes: 12,
  aired_on: null,
  released_on: null,
  rating: null,
  duration: 24,
  description: null,
  image_url: null,
  franchise: "test_franchise",
  shikimori_url: null,
  fetched_at: "",
  genres: [mockGenres[0], mockGenres[2]], // Action, Romance
  studios: [{ id: 10, name: "Studio A", image_url: null }],
  user_rate: null,
};

describe("buildGenreProfile", () => {
  it("builds weighted genre vector from rated anime", () => {
    const profile = buildGenreProfile([mockAnimeRated]);
    expect(profile.get(1)).toBe(1); // Action normalized to 1 (max)
    expect(profile.get(2)).toBe(1); // Fantasy normalized to 1 (max)
    expect(profile.has(3)).toBe(false); // Romance not rated
  });
});

describe("computeRecommendationScore", () => {
  it("returns score between 0 and 1", () => {
    const genreProfile = buildGenreProfile([mockAnimeRated]);
    const studioProfile = buildStudioProfile([mockAnimeRated]);
    const kindProfile = buildKindProfile([mockAnimeRated]);

    const score = computeRecommendationScore(
      mockAnimeCandidate,
      genreProfile,
      studioProfile,
      kindProfile,
      [mockAnimeRated]
    );

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("scores franchise match higher", () => {
    const genreProfile = buildGenreProfile([mockAnimeRated]);
    const studioProfile = buildStudioProfile([mockAnimeRated]);
    const kindProfile = buildKindProfile([mockAnimeRated]);

    const withFranchise = computeRecommendationScore(
      mockAnimeCandidate,
      genreProfile,
      studioProfile,
      kindProfile,
      [mockAnimeRated]
    );

    const noFranchise = computeRecommendationScore(
      { ...mockAnimeCandidate, franchise: "other" },
      genreProfile,
      studioProfile,
      kindProfile,
      [mockAnimeRated]
    );

    expect(withFranchise).toBeGreaterThan(noFranchise);
  });
});
```

- [ ] **Step 2: Install vitest and run test to verify it fails**

```bash
npm install -D vitest
npx vitest run src/lib/__tests__/recommendation.test.ts
```

Expected: FAIL — module `../recommendation` not found.

- [ ] **Step 3: Implement recommendation engine**

Create `src/lib/recommendation.ts`:

```typescript
import type { AnimeWithRelations } from "./types";

type Profile = Map<number, number>;

export function buildGenreProfile(ratedAnime: AnimeWithRelations[]): Profile {
  const weights = new Map<number, number>();

  for (const anime of ratedAnime) {
    const rate = anime.user_rate;
    if (!rate) continue;

    // Use score if available, swipe reaction as fallback
    let weight = rate.score;
    if (weight === 0 && rate.reaction === "like") weight = 8;
    if (weight === 0 && rate.reaction === "dislike") weight = -3;
    if (weight === 0) continue;

    for (const genre of anime.genres) {
      weights.set(genre.id, (weights.get(genre.id) ?? 0) + weight);
    }
  }

  // Normalize to [0, 1]
  const max = Math.max(...weights.values(), 1);
  const profile = new Map<number, number>();
  for (const [id, w] of weights) {
    profile.set(id, Math.max(0, w / max));
  }
  return profile;
}

export function buildStudioProfile(ratedAnime: AnimeWithRelations[]): Profile {
  const weights = new Map<number, number>();

  for (const anime of ratedAnime) {
    const rate = anime.user_rate;
    if (!rate) continue;

    let weight = rate.score;
    if (weight === 0 && rate.reaction === "like") weight = 8;
    if (weight === 0 && rate.reaction === "dislike") weight = -3;
    if (weight === 0) continue;

    for (const studio of anime.studios) {
      weights.set(studio.id, (weights.get(studio.id) ?? 0) + weight);
    }
  }

  const max = Math.max(...weights.values(), 1);
  const profile = new Map<number, number>();
  for (const [id, w] of weights) {
    profile.set(id, Math.max(0, w / max));
  }
  return profile;
}

export function buildKindProfile(ratedAnime: AnimeWithRelations[]): Profile {
  const kindMap: Record<string, number> = { tv: 1, movie: 2, ova: 3, ona: 4, special: 5 };
  const sums = new Map<number, number>();
  const counts = new Map<number, number>();

  for (const anime of ratedAnime) {
    const rate = anime.user_rate;
    if (!rate || rate.score === 0) continue;

    const kindId = kindMap[anime.kind] ?? 0;
    if (kindId === 0) continue;

    sums.set(kindId, (sums.get(kindId) ?? 0) + rate.score);
    counts.set(kindId, (counts.get(kindId) ?? 0) + 1);
  }

  const profile = new Map<number, number>();
  for (const [kindId, sum] of sums) {
    profile.set(kindId, sum / counts.get(kindId)! / 10); // normalize to [0, 1]
  }
  return profile;
}

export function computeRecommendationScore(
  anime: AnimeWithRelations,
  genreProfile: Profile,
  studioProfile: Profile,
  kindProfile: Profile,
  ratedAnime: AnimeWithRelations[]
): number {
  // Genre affinity: dot product with genre profile
  let genreScore = 0;
  if (anime.genres.length > 0) {
    let sum = 0;
    for (const genre of anime.genres) {
      sum += genreProfile.get(genre.id) ?? 0;
    }
    genreScore = sum / anime.genres.length;
  }

  // Studio affinity
  let studioScore = 0;
  if (anime.studios.length > 0) {
    let sum = 0;
    for (const studio of anime.studios) {
      sum += studioProfile.get(studio.id) ?? 0;
    }
    studioScore = sum / anime.studios.length;
  }

  // Kind affinity
  const kindMap: Record<string, number> = { tv: 1, movie: 2, ova: 3, ona: 4, special: 5 };
  const kindScore = kindProfile.get(kindMap[anime.kind] ?? 0) ?? 0.5;

  // Shikimori community score (normalize 0-10 to 0-1)
  const communityScore = (anime.score ?? 5) / 10;

  // Franchise bonus
  let franchiseBonus = 0;
  if (anime.franchise) {
    const franchiseRated = ratedAnime.find(
      (a) => a.franchise === anime.franchise && a.user_rate && a.user_rate.score >= 8
    );
    if (franchiseRated) franchiseBonus = 1;
  }

  return (
    genreScore * 0.4 +
    studioScore * 0.15 +
    kindScore * 0.1 +
    communityScore * 0.2 +
    franchiseBonus * 0.15
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/__tests__/recommendation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommendation.ts src/lib/__tests__/recommendation.test.ts
git commit -m "feat: add content-based recommendation engine with tests"
```

---

## Task 5: Server Actions

**Files:**
- Create: `src/actions/swipe.ts`
- Create: `src/actions/rate.ts`
- Create: `src/actions/recommend.ts`

- [ ] **Step 1: Create swipe action**

Create `src/actions/swipe.ts`:

```typescript
"use server";

import { supabase } from "@/lib/supabase";
import type { Reaction } from "@/lib/types";

export async function recordSwipe(animeId: number, reaction: Reaction) {
  const { error } = await supabase.from("user_rates").upsert(
    {
      anime_id: animeId,
      reaction,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "anime_id" }
  );

  if (error) throw new Error(`Failed to record swipe: ${error.message}`);
}
```

- [ ] **Step 2: Create rate action**

Create `src/actions/rate.ts`:

```typescript
"use server";

import { supabase } from "@/lib/supabase";
import type { UserRateStatus } from "@/lib/types";

export async function updateRate(
  animeId: number,
  updates: { score?: number; status?: UserRateStatus }
) {
  const { error } = await supabase.from("user_rates").upsert(
    {
      anime_id: animeId,
      ...updates,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "anime_id" }
  );

  if (error) throw new Error(`Failed to update rate: ${error.message}`);
}
```

- [ ] **Step 3: Create recommend action**

Create `src/actions/recommend.ts`:

```typescript
"use server";

import { supabase } from "@/lib/supabase";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  computeRecommendationScore,
} from "@/lib/recommendation";
import type { AnimeWithRelations, RecommendedAnime, Genre, Studio, UserRate } from "@/lib/types";

async function fetchAnimeWithRelations(
  filter?: { rated?: boolean; limit?: number; genreIds?: number[]; kinds?: string[]; minScore?: number; maxScore?: number; statuses?: string[]; yearFrom?: number; yearTo?: number; sortBy?: string }
): Promise<AnimeWithRelations[]> {
  let query = supabase.from("anime").select("*");

  if (filter?.kinds?.length) {
    query = query.in("kind", filter.kinds);
  }
  if (filter?.statuses?.length) {
    query = query.in("status", filter.statuses);
  }
  if (filter?.minScore) {
    query = query.gte("score", filter.minScore);
  }
  if (filter?.maxScore) {
    query = query.lte("score", filter.maxScore);
  }
  if (filter?.yearFrom) {
    query = query.gte("aired_on", `${filter.yearFrom}-01-01`);
  }
  if (filter?.yearTo) {
    query = query.lte("aired_on", `${filter.yearTo}-12-31`);
  }

  if (filter?.sortBy === "score") {
    query = query.order("score", { ascending: false, nullsFirst: false });
  } else if (filter?.sortBy === "year") {
    query = query.order("aired_on", { ascending: false, nullsFirst: false });
  }

  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data: animeList, error } = await query;
  if (error) throw error;
  if (!animeList) return [];

  // Fetch all relations in batch
  const animeIds = animeList.map((a) => a.id);

  const [genreLinks, studioLinks, rates, genres, studios] = await Promise.all([
    supabase.from("anime_genres").select("*").in("anime_id", animeIds),
    supabase.from("anime_studios").select("*").in("anime_id", animeIds),
    supabase.from("user_rates").select("*").in("anime_id", animeIds),
    supabase.from("genres").select("*"),
    supabase.from("studios").select("*"),
  ]);

  const genreMap = new Map<number, Genre>((genres.data ?? []).map((g) => [g.id, g]));
  const studioMap = new Map<number, Studio>((studios.data ?? []).map((s) => [s.id, s]));
  const rateMap = new Map<number, UserRate>((rates.data ?? []).map((r) => [r.anime_id, r]));
  const animeGenres = new Map<number, Genre[]>();
  const animeStudios = new Map<number, Studio[]>();

  for (const link of genreLinks.data ?? []) {
    const genre = genreMap.get(link.genre_id);
    if (genre) {
      const list = animeGenres.get(link.anime_id) ?? [];
      list.push(genre);
      animeGenres.set(link.anime_id, list);
    }
  }

  for (const link of studioLinks.data ?? []) {
    const studio = studioMap.get(link.studio_id);
    if (studio) {
      const list = animeStudios.get(link.anime_id) ?? [];
      list.push(studio);
      animeStudios.set(link.anime_id, list);
    }
  }

  return animeList.map((anime) => ({
    ...anime,
    genres: animeGenres.get(anime.id) ?? [],
    studios: animeStudios.get(anime.id) ?? [],
    user_rate: rateMap.get(anime.id) ?? null,
  }));
}

export async function getRecommendations(limit: number = 20): Promise<RecommendedAnime[]> {
  const allAnime = await fetchAnimeWithRelations();

  const rated = allAnime.filter((a) => a.user_rate !== null);
  const unrated = allAnime.filter(
    (a) => a.user_rate === null || (a.user_rate.score === 0 && a.user_rate.reaction === null)
  );

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);

  const scored: RecommendedAnime[] = unrated.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(
      anime,
      genreProfile,
      studioProfile,
      kindProfile,
      rated
    ),
  }));

  scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  return scored.slice(0, limit);
}

export async function getCatalog(filter?: {
  genreIds?: number[];
  kinds?: string[];
  minScore?: number;
  maxScore?: number;
  statuses?: string[];
  yearFrom?: number;
  yearTo?: number;
  sortBy?: string;
  limit?: number;
}): Promise<RecommendedAnime[]> {
  const allAnime = await fetchAnimeWithRelations(filter);
  const rated = allAnime.filter((a) => a.user_rate !== null);

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);

  const scored: RecommendedAnime[] = allAnime.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(
      anime,
      genreProfile,
      studioProfile,
      kindProfile,
      rated
    ),
  }));

  if (!filter?.sortBy || filter.sortBy === "recommendation") {
    scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  return scored;
}

export async function getMyList(status?: string): Promise<AnimeWithRelations[]> {
  const allAnime = await fetchAnimeWithRelations();
  const withRate = allAnime.filter((a) => a.user_rate !== null);

  if (status) {
    return withRate.filter((a) => a.user_rate!.status === status);
  }
  return withRate;
}

export async function getAnimeById(id: number): Promise<AnimeWithRelations | null> {
  const result = await fetchAnimeWithRelations({ limit: 1 });
  // Need direct fetch for single anime
  const { data: anime } = await supabase.from("anime").select("*").eq("id", id).single();
  if (!anime) return null;

  const [genreLinks, studioLinks, rate, genres, studios] = await Promise.all([
    supabase.from("anime_genres").select("*").eq("anime_id", id),
    supabase.from("anime_studios").select("*").eq("anime_id", id),
    supabase.from("user_rates").select("*").eq("anime_id", id).maybeSingle(),
    supabase.from("genres").select("*"),
    supabase.from("studios").select("*"),
  ]);

  const genreMap = new Map((genres.data ?? []).map((g) => [g.id, g]));
  const studioMap = new Map((studios.data ?? []).map((s) => [s.id, s]));

  return {
    ...anime,
    genres: (genreLinks.data ?? []).map((l) => genreMap.get(l.genre_id)!).filter(Boolean),
    studios: (studioLinks.data ?? []).map((l) => studioMap.get(l.studio_id)!).filter(Boolean),
    user_rate: rate.data ?? null,
  };
}

export async function getAllGenres(): Promise<Genre[]> {
  const { data } = await supabase.from("genres").select("*").order("russian");
  return data ?? [];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/
git commit -m "feat: add server actions for swipe, rate, and recommendations"
```

---

## Task 6: Layout + Bottom Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/bottom-nav.tsx`

- [ ] **Step 1: Create bottom navigation**

Create `src/components/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Swipe", icon: "🎴" },
  { href: "/catalog", label: "Catalog", icon: "📚" },
  { href: "/my-list", label: "My List", icon: "📋" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update globals.css for dark theme**

Replace `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090b;
  --foreground: #fafafa;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Hide scrollbar but allow scrolling */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

- [ ] **Step 3: Update root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Recommender",
  description: "Personal anime recommendation service",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-zinc-950 pb-16">
        <main className="mx-auto max-w-md">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify dev server**

```bash
npm run dev
```

Open http://localhost:3000 — should see dark page with bottom nav.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/bottom-nav.tsx
git commit -m "feat: add dark theme layout with bottom navigation"
```

---

## Task 7: Swipe Screen

**Files:**
- Create: `src/components/swipe-card.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create swipe card component**

Create `src/components/swipe-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { RecommendedAnime, Reaction } from "@/lib/types";
import { recordSwipe } from "@/actions/swipe";

export function SwipeCard({
  anime,
  onSwiped,
}: {
  anime: RecommendedAnime;
  onSwiped: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  function handleSwipe(reaction: Reaction) {
    const direction = reaction === "like" ? "right" : reaction === "dislike" ? "left" : null;
    setExiting(direction);

    startTransition(async () => {
      await recordSwipe(anime.id, reaction);
      setTimeout(() => {
        setExiting(null);
        onSwiped();
      }, 200);
    });
  }

  return (
    <div
      className={`flex flex-col transition-all duration-200 ${
        exiting === "left"
          ? "-translate-x-full opacity-0"
          : exiting === "right"
            ? "translate-x-full opacity-0"
            : ""
      }`}
    >
      {/* Poster */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl">
        {anime.image_url ? (
          <Image
            src={anime.image_url}
            alt={anime.russian ?? anime.name}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-500">
            No image
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-xl font-bold leading-tight">
            {anime.russian ?? anime.name}
          </h2>
          {anime.russian && (
            <p className="mt-0.5 text-sm text-zinc-400">{anime.name}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {anime.genres.slice(0, 4).map((g) => (
              <span
                key={g.id}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-zinc-300"
              >
                {g.russian ?? g.name}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
            {anime.score && <span>★ {anime.score.toFixed(1)}</span>}
            {anime.kind && <span className="uppercase">{anime.kind}</span>}
            {anime.episodes && <span>{anime.episodes} эп.</span>}
          </div>
        </div>
      </div>

      {/* Description */}
      {anime.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
          {anime.description.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "")}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={() => handleSwipe("dislike")}
          disabled={isPending}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 text-2xl text-red-400 transition-all hover:border-red-500 hover:bg-red-500/10 active:scale-90 disabled:opacity-50"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe("skip")}
          disabled={isPending}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-zinc-600/30 text-lg text-zinc-500 transition-all hover:border-zinc-500 hover:bg-zinc-500/10 active:scale-90 disabled:opacity-50"
        >
          →
        </button>
        <button
          onClick={() => handleSwipe("like")}
          disabled={isPending}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/30 text-2xl text-green-400 transition-all hover:border-green-500 hover:bg-green-500/10 active:scale-90 disabled:opacity-50"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create swipe page**

Replace `src/app/page.tsx` with:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { SwipeCard } from "@/components/swipe-card";
import { getRecommendations } from "@/actions/recommend";
import type { RecommendedAnime } from "@/lib/types";

export default function SwipePage() {
  const [queue, setQueue] = useState<RecommendedAnime[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    const recs = await getRecommendations(20);
    setQueue(recs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  function handleSwiped() {
    setQueue((prev) => {
      const next = prev.slice(1);
      // Reload when running low
      if (next.length <= 3) {
        loadRecommendations();
      }
      return next;
    });
  }

  if (loading && queue.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-zinc-500">
        Loading recommendations...
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-zinc-500">
        <p>No more recommendations</p>
        <button
          onClick={loadRecommendations}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <SwipeCard anime={queue[0]} onSwiped={handleSwiped} />
    </div>
  );
}
```

- [ ] **Step 3: Verify swipe screen**

```bash
npm run dev
```

Open http://localhost:3000 — should see anime card with swipe buttons (requires seeded data).

- [ ] **Step 4: Commit**

```bash
git add src/components/swipe-card.tsx src/app/page.tsx
git commit -m "feat: add swipe screen with recommendation cards"
```

---

## Task 8: Anime Card + Catalog Screen

**Files:**
- Create: `src/components/anime-card.tsx`
- Create: `src/components/filter-bar.tsx`
- Create: `src/app/catalog/page.tsx`

- [ ] **Step 1: Create anime card component**

Create `src/components/anime-card.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { RecommendedAnime } from "@/lib/types";

export function AnimeCard({ anime }: { anime: RecommendedAnime }) {
  return (
    <Link href={`/catalog/${anime.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
        {anime.image_url ? (
          <Image
            src={anime.image_url}
            alt={anime.russian ?? anime.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 448px) 50vw, 200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-xs">
            No image
          </div>
        )}

        {/* Score badge */}
        {anime.score && (
          <div className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-yellow-400">
            ★ {anime.score.toFixed(1)}
          </div>
        )}

        {/* User rate indicator */}
        {anime.user_rate && (
          <div className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-green-400">
            {anime.user_rate.score > 0 ? anime.user_rate.score : "✓"}
          </div>
        )}
      </div>

      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-tight text-zinc-200">
        {anime.russian ?? anime.name}
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        {anime.kind?.toUpperCase()}
        {anime.aired_on && ` · ${new Date(anime.aired_on).getFullYear()}`}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Create filter bar**

Create `src/components/filter-bar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getAllGenres } from "@/actions/recommend";
import type { Genre } from "@/lib/types";

export type CatalogFilters = {
  genreIds: number[];
  kinds: string[];
  minScore: number;
  statuses: string[];
  sortBy: string;
};

export function FilterBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
}) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [showGenres, setShowGenres] = useState(false);

  useEffect(() => {
    getAllGenres().then(setGenres);
  }, []);

  return (
    <div className="space-y-3">
      {/* Sort */}
      <div className="flex gap-2">
        {[
          { value: "recommendation", label: "For you" },
          { value: "score", label: "Rating" },
          { value: "year", label: "Year" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, sortBy: opt.value })}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filters.sortBy === opt.value
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        {["tv", "movie", "ova", "ona"].map((kind) => (
          <button
            key={kind}
            onClick={() => {
              const kinds = filters.kinds.includes(kind)
                ? filters.kinds.filter((k) => k !== kind)
                : [...filters.kinds, kind];
              onChange({ ...filters, kinds });
            }}
            className={`rounded-full px-3 py-1 text-xs uppercase transition-colors ${
              filters.kinds.includes(kind)
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {kind}
          </button>
        ))}
      </div>

      {/* Genre toggle */}
      <button
        onClick={() => setShowGenres(!showGenres)}
        className="text-xs text-zinc-400 hover:text-white"
      >
        {showGenres ? "Hide genres ▲" : "Genres ▼"}
      </button>

      {showGenres && (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                const genreIds = filters.genreIds.includes(g.id)
                  ? filters.genreIds.filter((id) => id !== g.id)
                  : [...filters.genreIds, g.id];
                onChange({ ...filters, genreIds });
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                filters.genreIds.includes(g.id)
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {g.russian ?? g.name}
            </button>
          ))}
        </div>
      )}

      {/* Min score */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>Min ★</span>
        <input
          type="range"
          min={0}
          max={9}
          step={1}
          value={filters.minScore}
          onChange={(e) =>
            onChange({ ...filters, minScore: parseInt(e.target.value) })
          }
          className="flex-1 accent-white"
        />
        <span className="w-4 text-right">{filters.minScore}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create catalog page**

Create `src/app/catalog/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimeCard } from "@/components/anime-card";
import { FilterBar, type CatalogFilters } from "@/components/filter-bar";
import { getCatalog } from "@/actions/recommend";
import type { RecommendedAnime } from "@/lib/types";

const defaultFilters: CatalogFilters = {
  genreIds: [],
  kinds: [],
  minScore: 0,
  statuses: [],
  sortBy: "recommendation",
};

export default function CatalogPage() {
  const [anime, setAnime] = useState<RecommendedAnime[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCatalog({
      genreIds: filters.genreIds.length ? filters.genreIds : undefined,
      kinds: filters.kinds.length ? filters.kinds : undefined,
      minScore: filters.minScore || undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      sortBy: filters.sortBy,
      limit: 100,
    });

    // Client-side genre filter (Supabase doesn't support many-to-many filter easily)
    let filtered = data;
    if (filters.genreIds.length > 0) {
      filtered = data.filter((a) =>
        filters.genreIds.every((gid) => a.genres.some((g) => g.id === gid))
      );
    }

    setAnime(filtered);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">Catalog</h1>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="mt-12 text-center text-zinc-500">Loading...</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {anime.map((a) => (
            <AnimeCard key={a.id} anime={a} />
          ))}
        </div>
      )}

      {!loading && anime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">
          Nothing found with these filters
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify catalog**

```bash
npm run dev
```

Open http://localhost:3000/catalog — should see grid of anime cards with filters.

- [ ] **Step 5: Commit**

```bash
git add src/components/anime-card.tsx src/components/filter-bar.tsx src/app/catalog/page.tsx
git commit -m "feat: add catalog screen with filters and anime cards"
```

---

## Task 9: Anime Detail Page

**Files:**
- Create: `src/app/catalog/[id]/page.tsx`

- [ ] **Step 1: Create detail page**

Create `src/app/catalog/[id]/page.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeById } from "@/actions/recommend";

export default async function AnimeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const anime = await getAnimeById(parseInt(params.id));
  if (!anime) notFound();

  return (
    <div className="px-4 pb-8 pt-4">
      {/* Back */}
      <Link
        href="/catalog"
        className="mb-4 inline-block text-sm text-zinc-400 hover:text-white"
      >
        ← Catalog
      </Link>

      {/* Poster + Info */}
      <div className="flex gap-4">
        <div className="relative aspect-[3/4] w-32 flex-shrink-0 overflow-hidden rounded-lg">
          {anime.image_url ? (
            <Image
              src={anime.image_url}
              alt={anime.russian ?? anime.name}
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-xs">
              No image
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">
            {anime.russian ?? anime.name}
          </h1>
          {anime.russian && (
            <p className="mt-0.5 text-sm text-zinc-400">{anime.name}</p>
          )}

          <div className="mt-2 space-y-1 text-sm text-zinc-400">
            {anime.score && (
              <p>
                ★ {anime.score.toFixed(1)}{" "}
                <span className="text-zinc-600">Shikimori</span>
              </p>
            )}
            <p className="uppercase">{anime.kind}</p>
            {anime.episodes && <p>{anime.episodes} episodes</p>}
            {anime.duration && <p>{anime.duration} min/ep</p>}
            {anime.aired_on && (
              <p>{new Date(anime.aired_on).getFullYear()}</p>
            )}
            {anime.rating && <p>{anime.rating.toUpperCase()}</p>}
          </div>

          {/* User rate */}
          {anime.user_rate && (
            <div className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs">
              <span className="text-zinc-400">Your score: </span>
              <span className="text-white">
                {anime.user_rate.score > 0 ? anime.user_rate.score : "—"}
              </span>
              <span className="ml-2 text-zinc-400">
                {anime.user_rate.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Genres */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {anime.genres.map((g) => (
          <span
            key={g.id}
            className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
          >
            {g.russian ?? g.name}
          </span>
        ))}
      </div>

      {/* Studios */}
      {anime.studios.length > 0 && (
        <div className="mt-3 text-sm text-zinc-400">
          Studio: {anime.studios.map((s) => s.name).join(", ")}
        </div>
      )}

      {/* Description */}
      {anime.description && (
        <div className="mt-4 text-sm leading-relaxed text-zinc-300">
          {anime.description.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "")}
        </div>
      )}

      {/* External link */}
      {anime.shikimori_url && (
        <a
          href={anime.shikimori_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Open on Shikimori →
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/catalog/\\[id\\]/page.tsx
git commit -m "feat: add anime detail page"
```

---

## Task 10: My List Screen

**Files:**
- Create: `src/components/rate-editor.tsx`
- Create: `src/app/my-list/page.tsx`

- [ ] **Step 1: Create rate editor**

Create `src/components/rate-editor.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateRate } from "@/actions/rate";
import type { UserRateStatus } from "@/lib/types";

const statuses: { value: UserRateStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export function RateEditor({
  animeId,
  currentScore,
  currentStatus,
}: {
  animeId: number;
  currentScore: number;
  currentStatus: string | null;
}) {
  const [score, setScore] = useState(currentScore);
  const [status, setStatus] = useState(currentStatus ?? "planned");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateRate(animeId, {
        score,
        status: status as UserRateStatus,
      });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          startTransition(async () => {
            await updateRate(animeId, {
              score,
              status: e.target.value as UserRateStatus,
            });
          });
        }}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
      >
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={score}
        onChange={(e) => {
          const newScore = parseInt(e.target.value);
          setScore(newScore);
          startTransition(async () => {
            await updateRate(animeId, {
              score: newScore,
              status: status as UserRateStatus,
            });
          });
        }}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
      >
        <option value={0}>—</option>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      {isPending && <span className="text-xs text-zinc-500">saving...</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create my list page**

Create `src/app/my-list/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getMyList } from "@/actions/recommend";
import { RateEditor } from "@/components/rate-editor";
import type { AnimeWithRelations } from "@/lib/types";

const tabs = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export default function MyListPage() {
  const [anime, setAnime] = useState<AnimeWithRelations[]>([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getMyList(tab || undefined);
    setAnime(data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">My List</h1>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
              tab === t.value
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 text-center text-zinc-500">Loading...</div>
      ) : (
        <div className="mt-4 space-y-3">
          {anime.map((a) => (
            <div key={a.id} className="flex gap-3 rounded-lg bg-zinc-900 p-2.5">
              <Link
                href={`/catalog/${a.id}`}
                className="relative aspect-[3/4] w-16 flex-shrink-0 overflow-hidden rounded"
              >
                {a.image_url ? (
                  <Image
                    src={a.image_url}
                    alt={a.russian ?? a.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-[10px]">
                    ?
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col justify-between">
                <Link href={`/catalog/${a.id}`}>
                  <h3 className="line-clamp-1 text-sm font-medium text-zinc-200">
                    {a.russian ?? a.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {a.kind?.toUpperCase()}
                    {a.score && ` · ★ ${a.score.toFixed(1)}`}
                    {a.episodes && ` · ${a.episodes} эп.`}
                  </p>
                </Link>

                <RateEditor
                  animeId={a.id}
                  currentScore={a.user_rate?.score ?? 0}
                  currentStatus={a.user_rate?.status ?? null}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && anime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">No anime in this list</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify my list**

```bash
npm run dev
```

Open http://localhost:3000/my-list — should see imported anime with inline editors.

- [ ] **Step 4: Commit**

```bash
git add src/components/rate-editor.tsx src/app/my-list/page.tsx
git commit -m "feat: add my list screen with inline rate editing"
```

---

## Task 11: Next.js Config + Vercel Deploy

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: Configure image domains**

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shikimori.one",
      },
      {
        protocol: "https",
        hostname: "shikimori.io",
      },
    ],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 2: Run full build check**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add next.config.js
git commit -m "feat: configure image domains for Shikimori"
```

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 6: Verify production**

Open the Vercel URL, check all three screens work.
