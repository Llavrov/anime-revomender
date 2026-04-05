"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  hideWatched: true,
};

export default function CatalogPage() {
  const [anime, setAnime] = useState<RecommendedAnime[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCatalog({
      genreIds: filters.genreIds.length ? filters.genreIds : undefined,
      kinds: filters.kinds.length ? filters.kinds : undefined,
      minScore: filters.minScore || undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      sortBy: filters.sortBy,
      limit: 100,
    });

    let filtered = data;

    if (filters.genreIds.length > 0) {
      filtered = filtered.filter((a) =>
        filters.genreIds.every((gid) => a.genres.some((g) => g.id === gid))
      );
    }

    if (filters.hideWatched) {
      filtered = filtered.filter(
        (a) => !a.user_rate || a.user_rate.status !== "completed"
      );
    }

    setAnime(filtered);
    setHiddenIds(new Set());
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistically hide a card and debounce the full reload
  const handleMarkedWatched = useCallback(
    (animeId: number) => {
      if (filters.hideWatched) {
        setHiddenIds((prev) => new Set(prev).add(animeId));
      }

      // Debounce: only reload 5s after the last mark
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        load();
      }, 5000);
    },
    [filters.hideWatched, load]
  );

  const visibleAnime = anime.filter((a) => !hiddenIds.has(a.id));

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">Каталог</h1>
      <FilterBar filters={filters} onChange={setFilters} />
      {loading ? (
        <div className="mt-12 text-center text-zinc-500">Загрузка...</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAnime.map((a) => (
            <AnimeCard
              key={a.id}
              anime={a}
              onMarkedWatched={handleMarkedWatched}
            />
          ))}
        </div>
      )}
      {!loading && visibleAnime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">
          Ничего не найдено с этими фильтрами
        </div>
      )}
    </div>
  );
}
