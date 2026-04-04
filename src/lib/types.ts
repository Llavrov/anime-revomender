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
