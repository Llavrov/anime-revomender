"use server";

import { supabase } from "@/lib/supabase";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  buildEraProfile,
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
  const eraProfile = buildEraProfile(rated);

  const scored: RecommendedAnime[] = unrated.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(
      anime,
      genreProfile,
      studioProfile,
      kindProfile,
      eraProfile,
      rated
    ),
  }));

  // Filter out weak matches
  const filtered = scored.filter((a) => a.recommendation_score >= 0.45);
  filtered.sort((a, b) => b.recommendation_score - a.recommendation_score);
  return filtered.slice(0, limit);
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
  const eraProfile = buildEraProfile(rated);

  const scored: RecommendedAnime[] = allAnime.map((anime) => ({
    ...anime,
    recommendation_score: computeRecommendationScore(
      anime,
      genreProfile,
      studioProfile,
      kindProfile,
      eraProfile,
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
