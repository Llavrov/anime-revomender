import type { AnimeWithRelations } from "./types";
import { detectTropes, type Trope } from "./tropes";

type Profile = Map<number, number>;
type TropeProfile = Map<Trope, number>;

export function buildEraProfile(ratedAnime: AnimeWithRelations[]): { median: number; stddev: number } {
  const years: number[] = [];
  for (const anime of ratedAnime) {
    if (!anime.aired_on) continue;
    const year = parseInt(anime.aired_on.toString().substring(0, 4), 10);
    if (!isNaN(year)) years.push(year);
  }
  if (years.length === 0) return { median: 2015, stddev: 10 };

  years.sort((a, b) => a - b);
  const median = years[Math.floor(years.length / 2)];
  const mean = years.reduce((a, b) => a + b, 0) / years.length;
  const variance = years.reduce((sum, y) => sum + (y - mean) ** 2, 0) / years.length;
  const stddev = Math.max(Math.sqrt(variance), 5);
  return { median, stddev };
}

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

export function buildTropeProfile(ratedAnime: AnimeWithRelations[]): TropeProfile {
  const weights = new Map<Trope, number>();
  const counts = new Map<Trope, number>();

  for (const anime of ratedAnime) {
    const rate = anime.user_rate;
    if (!rate) continue;

    let weight = rate.score;
    if (weight === 0 && rate.reaction === "like") weight = 8;
    if (weight === 0 && rate.reaction === "dislike") weight = -3;
    if (weight === 0) continue;

    const tropes = detectTropes(anime);
    for (const trope of tropes) {
      weights.set(trope, (weights.get(trope) ?? 0) + weight);
      counts.set(trope, (counts.get(trope) ?? 0) + 1);
    }
  }

  const profile = new Map<Trope, number>();
  for (const [trope, totalWeight] of Array.from(weights.entries())) {
    const count = counts.get(trope) ?? 1;
    // Normalize: average weight / 10, clamped to 0-1
    profile.set(trope, Math.max(0, Math.min(1, totalWeight / count / 10)));
  }
  return profile;
}

export function computeRecommendationScore(
  anime: AnimeWithRelations,
  genreProfile: Profile,
  studioProfile: Profile,
  kindProfile: Profile,
  eraProfile: { median: number; stddev: number },
  tropeProfile: TropeProfile,
  ratedAnime: AnimeWithRelations[]
): number {
  // Genre affinity (0-1)
  let genreScore = 0;
  if (anime.genres.length > 0) {
    let sum = 0;
    for (const genre of anime.genres) {
      sum += genreProfile.get(genre.id) ?? 0;
    }
    genreScore = sum / anime.genres.length;
  }

  // Studio affinity (0-1)
  let studioScore = 0;
  if (anime.studios.length > 0) {
    let sum = 0;
    for (const studio of anime.studios) {
      sum += studioProfile.get(studio.id) ?? 0;
    }
    studioScore = sum / anime.studios.length;
  }

  // Kind affinity (0-1)
  const kindMap: Record<string, number> = { tv: 1, movie: 2, ova: 3, ona: 4, special: 5 };
  const kindScore = kindProfile.get(kindMap[anime.kind] ?? 0) ?? 0.3;

  // Community score — penalize below 7.0 hard, reward 8+
  const rawScore = anime.score ?? 5;
  let communityScore: number;
  if (rawScore >= 8) {
    communityScore = 0.8 + (rawScore - 8) * 0.15;
  } else if (rawScore >= 7) {
    communityScore = 0.5 + (rawScore - 7) * 0.3;
  } else {
    communityScore = Math.max(0, rawScore / 14);
  }

  // Era affinity — gaussian decay from user's median year
  let eraScore = 0.5;
  if (anime.aired_on) {
    const year = parseInt(anime.aired_on.toString().substring(0, 4), 10);
    if (!isNaN(year)) {
      const distance = Math.abs(year - eraProfile.median);
      eraScore = Math.exp(-0.5 * (distance / eraProfile.stddev) ** 2);
    }
  }

  // Trope affinity — bonus for matching tropes
  let tropeScore = 0;
  const animeTropes = detectTropes(anime);
  if (animeTropes.length > 0 && tropeProfile.size > 0) {
    let sum = 0;
    for (const trope of animeTropes) {
      sum += tropeProfile.get(trope) ?? 0;
    }
    tropeScore = sum / animeTropes.length;
  }

  // Franchise bonus
  let franchiseBonus = 0;
  if (anime.franchise) {
    const franchiseRated = ratedAnime.find(
      (a) => a.franchise === anime.franchise && a.user_rate && a.user_rate.score >= 8
    );
    if (franchiseRated) franchiseBonus = 1;
  }

  return (
    genreScore * 0.25 +
    communityScore * 0.20 +
    tropeScore * 0.15 +
    eraScore * 0.12 +
    franchiseBonus * 0.13 +
    studioScore * 0.10 +
    kindScore * 0.05
  );
}
