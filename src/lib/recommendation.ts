import type { AnimeWithRelations } from "./types";

type Profile = Map<number, number>;

export function buildGenreProfile(ratedAnime: AnimeWithRelations[]): Profile {
  const weights = new Map<number, number>();

  for (const anime of ratedAnime) {
    const rate = anime.user_rate;
    if (!rate) continue;

    let weight = rate.score;
    if (weight === 0 && rate.reaction === "like") weight = 8;
    if (weight === 0 && rate.reaction === "dislike") weight = -3;
    if (weight === 0) continue;

    for (const genre of anime.genres) {
      weights.set(genre.id, (weights.get(genre.id) ?? 0) + weight);
    }
  }

  const max = Math.max(...Array.from(weights.values()), 1);
  const profile = new Map<number, number>();
  for (const [id, w] of Array.from(weights.entries())) {
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

  const max = Math.max(...Array.from(weights.values()), 1);
  const profile = new Map<number, number>();
  for (const [id, w] of Array.from(weights.entries())) {
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
  for (const [kindId, sum] of Array.from(sums.entries())) {
    profile.set(kindId, sum / counts.get(kindId)! / 10);
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
  let genreScore = 0;
  if (anime.genres.length > 0) {
    let sum = 0;
    for (const genre of anime.genres) {
      sum += genreProfile.get(genre.id) ?? 0;
    }
    genreScore = sum / anime.genres.length;
  }

  let studioScore = 0;
  if (anime.studios.length > 0) {
    let sum = 0;
    for (const studio of anime.studios) {
      sum += studioProfile.get(studio.id) ?? 0;
    }
    studioScore = sum / anime.studios.length;
  }

  const kindMap: Record<string, number> = { tv: 1, movie: 2, ova: 3, ona: 4, special: 5 };
  const kindScore = kindProfile.get(kindMap[anime.kind] ?? 0) ?? 0.5;

  const communityScore = (anime.score ?? 5) / 10;

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
