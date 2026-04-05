"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimeCard } from "@/components/anime-card";
import { FilterBar, type CatalogFilters } from "@/components/filter-bar";
import { getCatalog } from "@/actions/recommend";
import type { RecommendedAnime } from "@/lib/types";

const defaultFilters: CatalogFilters = {
  genreIds: [],
  kinds: [],
  minScore: 0,
  statuses: [],
  sortBy: "recommendation",
  hideRated: true,
};

export default function CatalogPage() {
  const [anime, setAnime] = useState<RecommendedAnime[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    // Fetch more to compensate for filtered-out rated anime
    const data = await getCatalog({
      genreIds: filters.genreIds.length ? filters.genreIds : undefined,
      kinds: filters.kinds.length ? filters.kinds : undefined,
      minScore: filters.minScore || undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      sortBy: filters.sortBy,
      limit: 500,
    });

    let filtered = data;

    if (filters.genreIds.length > 0) {
      filtered = filtered.filter((a) =>
        filters.genreIds.every((gid) => a.genres.some((g) => g.id === gid))
      );
    }

    if (filters.hideRated) {
      filtered = filtered.filter((a) => {
        if (!a.user_rate) return true;
        const r = a.user_rate;
        if (r.reaction) return false;
        if (r.score > 0) return false;
        if (r.status === "completed") return false;
        return true;
      });
    }

    setAnime(filtered);
    setHiddenIds(new Set());
    setInitialLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleHideCard = useCallback(
    (animeId: number) => {
      if (filters.hideRated) {
        setHiddenIds((prev) => new Set(prev).add(animeId));
      }
    },
    [filters.hideRated]
  );

  const visibleAnime = anime.filter((a) => !hiddenIds.has(a.id));

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">Каталог</h1>
      <FilterBar filters={filters} onChange={setFilters} />
      {initialLoading ? (
        <div className="mt-12 text-center text-zinc-500">Загрузка...</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAnime.map((a) => (
            <AnimeCard
              key={a.id}
              anime={a}
              onHideCard={handleHideCard}
            />
          ))}
        </div>
      )}
      {!initialLoading && visibleAnime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">
          Ничего не найдено с этими фильтрами
        </div>
      )}
    </div>
  );
}
