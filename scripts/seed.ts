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

type ShikimoriGenre = {
  id: number;
  name: string;
  russian: string;
  kind: string;
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
  const animeGenres = genres.filter((g) => g.kind === "anime" || g.kind === "genre");

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

    for (const item of animeList) {
      const anime = await fetchShikimori<ShikimoriAnime>(`/animes/${item.id}`);

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

      for (const genre of anime.genres) {
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
    if (!rates || rates.length === 0) break;

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
        for (const genre of anime.genres) {
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
