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
  hideRated: true,
};

export default function CatalogPage() {
  const [anime, setAnime] = useState<RecommendedAnime[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [actionsCount, setActionsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
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
        // not_today is soft — still show in catalog
        if (r.reaction && r.reaction !== "not_today") return false;
        if (r.score > 0) return false;
        if (r.status === "completed") return false;
        return true;
      });
    }

    setAnime(filtered);
    setHiddenIds(new Set());
    setActionsCount(0);
    setInitialLoading(false);
    setRefreshing(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleHideCard = useCallback(
    (animeId: number) => {
      setHiddenIds((prev) => new Set(prev).add(animeId));
      setActionsCount((c) => c + 1);

      // Auto-refresh recommendations 8s after last action
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setRefreshing(true);
        load();
      }, 8000);
    },
    [load]
  );

  const handleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRefreshing(true);
    load();
  }, [load]);

  const visibleAnime = anime.filter((a) => !hiddenIds.has(a.id));

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Каталог</h1>
        {actionsCount > 0 && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {refreshing ? (
              "Обновляю..."
            ) : (
              <>Обновить рекомендации</>
            )}
          </button>
        )}
      </div>
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
