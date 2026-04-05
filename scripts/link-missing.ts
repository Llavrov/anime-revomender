import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHIKIMORI_BASE = "https://shikimori.one/api";
const USER_AGENT = "anime-recommender/1.0";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry<T>(path: string, retries = 3): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      await sleep(350);
      const res = await fetch(`${SHIKIMORI_BASE}${path}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        console.log(`  Rate limited, waiting 2s...`);
        await sleep(2000);
        continue;
      }
      if (!res.ok) {
        console.log(`  ${path}: ${res.status}, retry ${i + 1}`);
        await sleep(1000);
        continue;
      }
      return (await res.json()) as T;
    } catch (e: any) {
      console.log(`  ${path}: ${e.message}, retry ${i + 1}`);
      await sleep(1000);
    }
  }
  return null;
}

type ShikimoriAnime = {
  id: number;
  genres: { id: number; name: string; russian: string; kind: string }[];
  studios: { id: number; name: string; image: string | null }[];
};

async function main() {
  // Find anime IDs without genre links
  const { data: allAnime } = await supabase.from("anime").select("id");
  const { data: linkedGenres } = await supabase.from("anime_genres").select("anime_id");
  const linkedIds = new Set((linkedGenres ?? []).map((l) => l.anime_id));
  const unlinked = (allAnime ?? []).filter((a) => !linkedIds.has(a.id)).map((a) => a.id);

  console.log(`Found ${unlinked.length} anime without genre links. Starting...`);

  let done = 0;
  let skipped = 0;

  for (const animeId of unlinked) {
    const anime = await fetchWithRetry<ShikimoriAnime>(`/animes/${animeId}`);
    if (!anime) {
      skipped++;
      continue;
    }

    // Upsert genres
    for (const genre of anime.genres) {
      await supabase.from("genres").upsert({ id: genre.id, name: genre.name, russian: genre.russian });
      await supabase.from("anime_genres").upsert({ anime_id: animeId, genre_id: genre.id });
    }

    // Upsert studios
    for (const studio of anime.studios) {
      await supabase.from("studios").upsert({ id: studio.id, name: studio.name, image_url: studio.image });
      await supabase.from("anime_studios").upsert({ anime_id: animeId, studio_id: studio.id });
    }

    done++;
    if (done % 50 === 0) {
      console.log(`Progress: ${done}/${unlinked.length} done, ${skipped} skipped`);
    }
  }

  console.log(`Done! Linked ${done} anime, skipped ${skipped}`);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
