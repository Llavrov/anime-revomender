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
};

export default function CatalogPage() {
  const [anime, setAnime] = useState<RecommendedAnime[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);

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
      filtered = data.filter((a) =>
        filters.genreIds.every((gid) => a.genres.some((g) => g.id === gid))
      );
    }

    setAnime(filtered);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">Catalog</h1>
      <FilterBar filters={filters} onChange={setFilters} />
      {loading ? (
        <div className="mt-12 text-center text-zinc-500">Loading...</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {anime.map((a) => (
            <AnimeCard key={a.id} anime={a} />
          ))}
        </div>
      )}
      {!loading && anime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">
          Nothing found with these filters
        </div>
      )}
    </div>
  );
}
