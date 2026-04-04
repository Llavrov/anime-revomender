import { describe, it, expect } from "vitest";
import {
  buildGenreProfile,
  buildStudioProfile,
  buildKindProfile,
  computeRecommendationScore,
} from "../recommendation";
import type { Genre } from "../types";

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
  genres: [mockGenres[0], mockGenres[1]],
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
  genres: [mockGenres[0], mockGenres[2]],
  studios: [{ id: 10, name: "Studio A", image_url: null }],
  user_rate: null,
};

describe("buildGenreProfile", () => {
  it("builds weighted genre vector from rated anime", () => {
    const profile = buildGenreProfile([mockAnimeRated]);
    expect(profile.get(1)).toBe(1);
    expect(profile.get(2)).toBe(1);
    expect(profile.has(3)).toBe(false);
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
