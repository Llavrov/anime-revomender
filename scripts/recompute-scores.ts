import { createClient } from "@supabase/supabase-js";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  buildEraProfile,
  computeRecommendationScore,
} from "../src/lib/recommendation";
import type { AnimeWithRelations, Genre, Studio, UserRate } from "../src/lib/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log("Fetching all anime...");
  const { data: animeList } = await supabase.from("anime").select("*").limit(5000);
  if (!animeList) { console.log("No anime"); return; }

  const animeIds = animeList.map((a) => a.id);
  console.log(`Found ${animeIds.length} anime. Fetching relations...`);

  // Batch fetch
  async function batchIn<T>(table: string, column: string, ids: number[]): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await supabase.from(table).select("*").in(column, ids.slice(i, i + 500));
      if (data) results.push(...(data as T[]));
    }
    return results;
  }

  const [genreLinks, studioLinks, rates, genres, studios] = await Promise.all([
    batchIn<{ anime_id: number; genre_id: number }>("anime_genres", "anime_id", animeIds),
    batchIn<{ anime_id: number; studio_id: number }>("anime_studios", "anime_id", animeIds),
    batchIn<UserRate>("user_rates", "anime_id", animeIds),
    supabase.from("genres").select("*"),
    supabase.from("studios").select("*"),
  ]);

  const genreMap = new Map<number, Genre>((genres.data ?? []).map((g) => [g.id, g]));
  const studioMap = new Map<number, Studio>((studios.data ?? []).map((s) => [s.id, s]));
  const rateMap = new Map<number, UserRate>(rates.map((r) => [r.anime_id, r]));
  const animeGenresMap = new Map<number, Genre[]>();
  const animeStudiosMap = new Map<number, Studio[]>();

  for (const link of genreLinks) {
    const genre = genreMap.get(link.genre_id);
    if (genre) {
      const list = animeGenresMap.get(link.anime_id) ?? [];
      list.push(genre);
      animeGenresMap.set(link.anime_id, list);
    }
  }
  for (const link of studioLinks) {
    const studio = studioMap.get(link.studio_id);
    if (studio) {
      const list = animeStudiosMap.get(link.anime_id) ?? [];
      list.push(studio);
      animeStudiosMap.set(link.anime_id, list);
    }
  }

  const allAnime: AnimeWithRelations[] = animeList.map((anime) => ({
    ...anime,
    genres: animeGenresMap.get(anime.id) ?? [],
    studios: animeStudiosMap.get(anime.id) ?? [],
    user_rate: rateMap.get(anime.id) ?? null,
  }));

  const rated = allAnime.filter((a) => a.user_rate !== null);
  console.log(`Building profile from ${rated.length} rated anime...`);

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);
  const eraProfile = buildEraProfile(rated);

  console.log("Computing scores...");
  const now = new Date().toISOString();
  const rows = allAnime.map((anime) => ({
    anime_id: anime.id,
    score: computeRecommendationScore(anime, genreProfile, studioProfile, kindProfile, eraProfile, rated),
    computed_at: now,
  }));

  console.log("Upserting scores...");
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("recommendation_scores").upsert(batch, { onConflict: "anime_id" });
    if (error) console.log(`Batch ${i}: ${error.message}`);
  }

  const sorted = rows.sort((a, b) => b.score - a.score);
  console.log("\nTop 10 recommendations:");
  for (const row of sorted.slice(0, 10)) {
    const anime = allAnime.find((a) => a.id === row.anime_id)!;
    console.log(`  ${row.score.toFixed(3)} — ${anime.russian ?? anime.name}`);
  }

  console.log(`\nDone! Saved ${rows.length} scores.`);
}

main().catch(console.error);
