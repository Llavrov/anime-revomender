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

type ShikimoriAnimeList = {
  id: number;
  name: string;
  russian: string;
  image: { original: string };
  kind: string;
  score: string;
  status: string;
  episodes: number;
  aired_on: string | null;
  released_on: string | null;
}[];

type ShikimoriAnimeDetail = {
  id: number;
  name: string;
  russian: string;
  image: { original: string };
  kind: string;
  score: string;
  status: string;
  episodes: number;
  aired_on: string | null;
  released_on: string | null;
  rating: string;
  duration: number;
  description: string | null;
  franchise: string | null;
  url: string;
  genres: { id: number; name: string; russian: string; kind: string }[];
  studios: { id: number; name: string; image: string | null }[];
};

async function fetchAnimeList(params: string, maxPages: number): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchWithRetry<ShikimoriAnimeList>(`/animes?${params}&page=${page}&limit=50`);
    if (!data || data.length === 0) break;
    ids.push(...data.map((a) => a.id));
    console.log(`  Page ${page}: ${data.length} anime`);
  }
  return ids;
}

async function upsertAnimeDetail(anime: ShikimoriAnimeDetail) {
  // Upsert anime
  await supabase.from("anime").upsert({
    id: anime.id,
    name: anime.name,
    russian: anime.russian || null,
    kind: anime.kind,
    score: parseFloat(anime.score) || null,
    status: anime.status,
    episodes: anime.episodes || null,
    aired_on: anime.aired_on || null,
    released_on: anime.released_on || null,
    rating: anime.rating || null,
    duration: anime.duration || null,
    description: anime.description || null,
    image_url: anime.image?.original ? `https://shikimori.one${anime.image.original}` : null,
    franchise: anime.franchise || null,
    shikimori_url: anime.url ? `https://shikimori.one${anime.url}` : null,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "id" });

  // Upsert genres & links
  for (const genre of anime.genres) {
    await supabase.from("genres").upsert({ id: genre.id, name: genre.name, russian: genre.russian });
    await supabase.from("anime_genres").upsert({ anime_id: anime.id, genre_id: genre.id });
  }

  // Upsert studios & links
  for (const studio of anime.studios) {
    await supabase.from("studios").upsert({ id: studio.id, name: studio.name, image_url: studio.image });
    await supabase.from("anime_studios").upsert({ anime_id: anime.id, studio_id: studio.id });
  }
}

async function main() {
  // Check existing count
  const { count: existingCount } = await supabase.from("anime").select("id", { count: "exact", head: true });
  console.log(`Existing anime: ${existingCount}`);

  // Collect anime IDs from multiple sources
  const allIds = new Set<number>();

  // 1. Top ranked pages 41-80 (another 2000)
  console.log("\n=== Top ranked pages 41-80 ===");
  const topIds = await fetchAnimeList("order=ranked", 80);
  // We already have pages 1-40, so take from page 41+
  // Actually fetchAnimeList starts from page 1, let's start from 41
  for (let page = 41; page <= 80; page++) {
    const data = await fetchWithRetry<ShikimoriAnimeList>(`/animes?order=ranked&page=${page}&limit=50`);
    if (!data || data.length === 0) break;
    for (const a of data) allIds.add(a.id);
    if (page % 10 === 0) console.log(`  Page ${page}: total unique ${allIds.size}`);
  }

  // 2. Recent anime 2020-2026 sorted by popularity
  console.log("\n=== Recent anime 2020-2026 ===");
  for (let page = 1; page <= 60; page++) {
    const data = await fetchWithRetry<ShikimoriAnimeList>(`/animes?order=popularity&season=2020_2026&page=${page}&limit=50`);
    if (!data || data.length === 0) break;
    for (const a of data) allIds.add(a.id);
    if (page % 10 === 0) console.log(`  Page ${page}: total unique ${allIds.size}`);
  }

  // 3. Fantasy anime (covers isekai since Shikimori doesn't have isekai genre)
  console.log("\n=== Fantasy anime ===");
  for (let page = 1; page <= 40; page++) {
    const data = await fetchWithRetry<ShikimoriAnimeList>(`/animes?order=popularity&genre=10&page=${page}&limit=50`);
    if (!data || data.length === 0) break;
    for (const a of data) allIds.add(a.id);
    if (page % 10 === 0) console.log(`  Page ${page}: total unique ${allIds.size}`);
  }

  // 4. Action anime
  console.log("\n=== Action anime ===");
  for (let page = 1; page <= 40; page++) {
    const data = await fetchWithRetry<ShikimoriAnimeList>(`/animes?order=popularity&genre=1&page=${page}&limit=50`);
    if (!data || data.length === 0) break;
    for (const a of data) allIds.add(a.id);
    if (page % 10 === 0) console.log(`  Page ${page}: total unique ${allIds.size}`);
  }

  // Remove already existing IDs
  const { data: existing } = await supabase.from("anime").select("id");
  const existingIds = new Set((existing ?? []).map((a) => a.id));
  const newIds = Array.from(allIds).filter((id) => !existingIds.has(id));

  console.log(`\nTotal unique IDs: ${allIds.size}`);
  console.log(`Already in DB: ${allIds.size - newIds.length}`);
  console.log(`New to fetch: ${newIds.length}`);

  // Fetch details for new anime
  let done = 0;
  let skipped = 0;
  for (const id of newIds) {
    const detail = await fetchWithRetry<ShikimoriAnimeDetail>(`/animes/${id}`);
    if (!detail) {
      skipped++;
      continue;
    }
    await upsertAnimeDetail(detail);
    done++;
    if (done % 100 === 0) {
      console.log(`Progress: ${done}/${newIds.length} done, ${skipped} skipped`);
    }
  }

  console.log(`\nDone! Added ${done} new anime, skipped ${skipped}`);
  console.log(`Total in DB: ${(existingCount ?? 0) + done}`);
}

main().catch(console.error);
