"use server";

import { supabase } from "@/lib/supabase";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  buildEraProfile,
  buildTropeProfile,
  computeRecommendationScore,
} from "@/lib/recommendation";
import type { AnimeWithRelations, RecommendedAnime, Genre, Studio, UserRate } from "@/lib/types";

// ── Shared fetcher ──────────────────────────────────────────────

async function fetchAnimeWithRelations(
  filter?: { rated?: boolean; limit?: number; genreIds?: number[]; kinds?: string[]; minScore?: number; maxScore?: number; statuses?: string[]; yearFrom?: number; yearTo?: number; sortBy?: string }
): Promise<AnimeWithRelations[]> {
  let query = supabase.from("anime").select("*");

  if (filter?.kinds?.length) query = query.in("kind", filter.kinds);
  if (filter?.statuses?.length) query = query.in("status", filter.statuses);
  if (filter?.minScore) query = query.gte("score", filter.minScore);
  if (filter?.maxScore) query = query.lte("score", filter.maxScore);
  if (filter?.yearFrom) query = query.gte("aired_on", `${filter.yearFrom}-01-01`);
  if (filter?.yearTo) query = query.lte("aired_on", `${filter.yearTo}-12-31`);

  if (filter?.sortBy === "score") {
    query = query.order("score", { ascending: false, nullsFirst: false });
  } else if (filter?.sortBy === "year") {
    query = query.order("aired_on", { ascending: false, nullsFirst: false });
  }

  query = query.limit(filter?.limit ?? 5000);

  const { data: animeList, error } = await query;
  if (error) throw error;
  if (!animeList) return [];

  const animeIds = animeList.map((a) => a.id);

  async function batchIn<T>(table: string, column: string, ids: number[], select = "*"): Promise<T[]> {
    const BATCH = 500;
    const results: T[] = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { data } = await supabase.from(table).select(select).in(column, batch);
      if (data) results.push(...(data as T[]));
    }
    return results;
  }

  const [genreLinksData, studioLinksData, ratesData, genres, studios] = await Promise.all([
    batchIn<{ anime_id: number; genre_id: number }>("anime_genres", "anime_id", animeIds),
    batchIn<{ anime_id: number; studio_id: number }>("anime_studios", "anime_id", animeIds),
    batchIn<UserRate>("user_rates", "anime_id", animeIds),
    supabase.from("genres").select("*"),
    supabase.from("studios").select("*"),
  ]);

  const genreMap = new Map<number, Genre>((genres.data ?? []).map((g) => [g.id, g]));
  const studioMap = new Map<number, Studio>((studios.data ?? []).map((s) => [s.id, s]));
  const rateMap = new Map<number, UserRate>((ratesData).map((r) => [r.anime_id, r]));
  const animeGenres = new Map<number, Genre[]>();
  const animeStudios = new Map<number, Studio[]>();

  for (const link of genreLinksData) {
    const genre = genreMap.get(link.genre_id);
    if (genre) {
      const list = animeGenres.get(link.anime_id) ?? [];
      list.push(genre);
      animeGenres.set(link.anime_id, list);
    }
  }

  for (const link of studioLinksData) {
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

// ── Recompute all scores and save to DB ─────────────────────────

export async function recomputeScores(): Promise<void> {
  const allAnime = await fetchAnimeWithRelations();
  const rated = allAnime.filter((a) => a.user_rate !== null);

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);
  const eraProfile = buildEraProfile(rated);
  const tropeProfile = buildTropeProfile(rated);

  const now = new Date().toISOString();
  const rows = allAnime.map((anime) => ({
    anime_id: anime.id,
    score: computeRecommendationScore(anime, genreProfile, studioProfile, kindProfile, eraProfile, tropeProfile, rated),
    computed_at: now,
  }));

  // Upsert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await supabase.from("recommendation_scores").upsert(batch, { onConflict: "anime_id" });
  }
}

// ── Swipe recommendations (real-time compute, small set) ────────

export async function getRecommendations(limit: number = 20): Promise<RecommendedAnime[]> {
  const NOT_TODAY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();
  const allAnime = await fetchAnimeWithRelations();

  const rated = allAnime.filter((a) => a.user_rate !== null);
  const unrated = allAnime.filter((a) => {
    if (!a.user_rate) return true;
    if (a.user_rate.score === 0 && a.user_rate.reaction === null) return true;
    if (a.user_rate.reaction === "not_today") {
      return now - new Date(a.user_rate.updated_at).getTime() > NOT_TODAY_COOLDOWN_MS;
    }
    return false;
  });

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);
  const eraProfile = buildEraProfile(rated);
  const tropeProfile = buildTropeProfile(rated);

  const scored: RecommendedAnime[] = unrated.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(anime, genreProfile, studioProfile, kindProfile, eraProfile, tropeProfile, rated),
  }));

  const filtered = scored.filter((a) => a.recommendation_score >= 0.45);
  filtered.sort((a, b) => b.recommendation_score - a.recommendation_score);
  return filtered.slice(0, limit);
}

// ── Catalog — reads cached scores, fast ─────────────────────────

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
  // Try reading cached scores
  const { data: cachedScores } = await supabase
    .from("recommendation_scores")
    .select("anime_id, score")
    .limit(5000);

  const scoreMap = new Map<number, number>();
  if (cachedScores && cachedScores.length > 0) {
    for (const row of cachedScores) {
      scoreMap.set(row.anime_id, row.score);
    }
  }

  // If no cached scores, fall back to real-time compute
  if (scoreMap.size === 0) {
    return getCatalogRealtime(filter);
  }

  // Fast path: fetch anime with relations (light query, no scoring needed)
  const allAnime = await fetchAnimeWithRelations({ ...filter, limit: undefined });

  const scored: RecommendedAnime[] = allAnime.map((anime) => ({
    ...anime,
    recommendation_score: scoreMap.get(anime.id) ?? 0,
  }));

  if (!filter?.sortBy || filter.sortBy === "recommendation") {
    scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  if (filter?.limit) {
    return scored.slice(0, filter.limit);
  }
  return scored;
}

// Fallback for when cache is empty
async function getCatalogRealtime(filter?: {
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
  const allAnime = await fetchAnimeWithRelations({ ...filter, limit: undefined });
  const rated = allAnime.filter((a) => a.user_rate !== null);

  const genreProfile = buildGenreProfile(rated);
  const studioProfile = buildStudioProfile(rated);
  const kindProfile = buildKindProfile(rated);
  const eraProfile = buildEraProfile(rated);
  const tropeProfile = buildTropeProfile(rated);

  const scored: RecommendedAnime[] = allAnime.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(anime, genreProfile, studioProfile, kindProfile, eraProfile, tropeProfile, rated),
  }));

  if (!filter?.sortBy || filter.sortBy === "recommendation") {
    scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  if (filter?.limit) return scored.slice(0, filter.limit);
  return scored;
}

// ── Other endpoints ─────────────────────────────────────────────

export async function getMyList(status?: string): Promise<AnimeWithRelations[]> {
  const allAnime = await fetchAnimeWithRelations();
  const withRate = allAnime.filter((a) => a.user_rate !== null);

  if (status) {
    return withRate.filter((a) => a.user_rate!.status === status);
  }
  return withRate;
}

export async function getAnimeById(id: number): Promise<AnimeWithRelations | null> {
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

// ── Profile stats (uses cached scores for strongMatchCount) ─────

export type ProfileStats = {
  totalRated: number;
  likes: number;
  dislikes: number;
  skips: number;
  topGenres: string[];
  profileStrength: "weak" | "building" | "good" | "strong";
  strongMatchCount: number;
};

export async function getProfileStats(): Promise<ProfileStats> {
  const { data: rates } = await supabase.from("user_rates").select("*");
  if (!rates) return { totalRated: 0, likes: 0, dislikes: 0, skips: 0, topGenres: [], profileStrength: "weak", strongMatchCount: 0 };

  const likes = rates.filter((r) => r.reaction === "like" || (r.score && r.score >= 7)).length;
  const dislikes = rates.filter((r) => r.reaction === "dislike" || (r.score && r.score > 0 && r.score <= 5)).length;
  const skips = rates.filter((r) => r.reaction === "skip").length;
  const totalRated = rates.length;

  const likedIds = rates
    .filter((r) => r.reaction === "like" || (r.score && r.score >= 7))
    .map((r) => r.anime_id);

  let topGenres: string[] = [];
  if (likedIds.length > 0) {
    const { data: genreLinks } = await supabase.from("anime_genres").select("genre_id").in("anime_id", likedIds.slice(0, 500));
    const genreCounts = new Map<number, number>();
    for (const link of genreLinks ?? []) {
      genreCounts.set(link.genre_id, (genreCounts.get(link.genre_id) ?? 0) + 1);
    }
    const topIds = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const { data: genres } = await supabase.from("genres").select("*").in("id", topIds);
    topGenres = (genres ?? []).map((g) => g.russian || g.name);
  }

  const signals = likes + dislikes;
  const profileStrength: ProfileStats["profileStrength"] =
    signals >= 80 ? "strong" : signals >= 40 ? "good" : signals >= 15 ? "building" : "weak";

  // Use cached scores for strong match count (fast!)
  const { data: strongScores } = await supabase
    .from("recommendation_scores")
    .select("anime_id")
    .gte("score", 0.6);

  const ratedIds = new Set(rates.map((r) => r.anime_id));
  const strongMatchCount = (strongScores ?? []).filter((s) => !ratedIds.has(s.anime_id)).length;

  return { totalRated, likes, dislikes, skips, topGenres, profileStrength, strongMatchCount };
}
