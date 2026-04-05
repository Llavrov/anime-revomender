"use client";

import { useState, useEffect } from "react";
import { getAllGenres } from "@/actions/recommend";
import type { Genre } from "@/lib/types";

export type CatalogFilters = {
  genreIds: number[];
  kinds: string[];
  minScore: number;
  statuses: string[];
  sortBy: string;
  hideRated: boolean;
};

const KIND_LABELS: Record<string, string> = {
  tv: "Сериал",
  movie: "Фильм",
  ova: "OVA",
  ona: "ONA",
  special: "Спецвыпуск",
};

const SORT_OPTIONS = [
  { value: "recommendation", label: "Для тебя" },
  { value: "score", label: "По рейтингу" },
  { value: "year", label: "По году" },
];

export function FilterBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
}) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [showGenres, setShowGenres] = useState(false);

  useEffect(() => {
    getAllGenres().then(setGenres);
  }, []);

  return (
    <div className="space-y-3">
      {/* Sort */}
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, sortBy: opt.value })}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filters.sortBy === opt.value
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Kind + hideWatched */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(KIND_LABELS).map(([kind, label]) => (
          <button
            key={kind}
            onClick={() => {
              const kinds = filters.kinds.includes(kind)
                ? filters.kinds.filter((k) => k !== kind)
                : [...filters.kinds, kind];
              onChange({ ...filters, kinds });
            }}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filters.kinds.includes(kind)
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto">
          <button
            onClick={() => onChange({ ...filters, hideRated: !filters.hideRated })}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filters.hideRated
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {filters.hideRated ? "Оценённое скрыто" : "Показать всё"}
          </button>
        </div>
      </div>

      {/* Genres */}
      <button
        onClick={() => setShowGenres(!showGenres)}
        className="text-xs text-zinc-400 hover:text-white"
      >
        {showGenres ? "Скрыть жанры ▲" : "Жанры ▼"}
      </button>
      {showGenres && (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                const genreIds = filters.genreIds.includes(g.id)
                  ? filters.genreIds.filter((id) => id !== g.id)
                  : [...filters.genreIds, g.id];
                onChange({ ...filters, genreIds });
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                filters.genreIds.includes(g.id)
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {g.russian ?? g.name}
            </button>
          ))}
        </div>
      )}

      {/* Min score */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>Мин. ★</span>
        <input
          type="range"
          min={0}
          max={9}
          step={1}
          value={filters.minScore}
          onChange={(e) =>
            onChange({ ...filters, minScore: parseInt(e.target.value) })
          }
          className="flex-1 accent-white"
        />
        <span className="w-4 text-right">{filters.minScore}</span>
      </div>
    </div>
  );
}
