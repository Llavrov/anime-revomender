"use client";

import { useEffect, useState, useCallback } from "react";
import { SwipeCard } from "@/components/swipe-card";
import { getRecommendations, getProfileStats } from "@/actions/recommend";
import type { RecommendedAnime } from "@/lib/types";
import type { ProfileStats } from "@/actions/recommend";

const STRENGTH_LABELS: Record<ProfileStats["profileStrength"], { label: string; color: string; hint: string }> = {
  weak: { label: "Слабый", color: "bg-red-500", hint: "Оцени ещё ~15 аниме для базовых рекомендаций" },
  building: { label: "Растёт", color: "bg-yellow-500", hint: "Рекомендации уже работают, но станут точнее" },
  good: { label: "Хороший", color: "bg-green-500", hint: "Рекомендации точные, можно переходить в каталог" },
  strong: { label: "Сильный", color: "bg-emerald-400", hint: "Профиль отличный, рекомендации максимально точные" },
};

export default function SwipePage() {
  const [queue, setQueue] = useState<RecommendedAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    const recs = await getRecommendations(20);
    setQueue(recs);
    setLoading(false);
  }, []);

  const refreshStats = useCallback(async () => {
    const s = await getProfileStats();
    setStats(s);
  }, []);

  useEffect(() => {
    loadRecommendations();
    refreshStats();
  }, [loadRecommendations, refreshStats]);

  function handleSwiped() {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length <= 3) {
        loadRecommendations();
        refreshStats();
      }
      return next;
    });
  }

  const strength = stats ? STRENGTH_LABELS[stats.profileStrength] : null;

  if (loading && queue.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-zinc-500">
        Loading recommendations...
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-zinc-500">
        <p>No more recommendations</p>
        <button
          onClick={loadRecommendations}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-4">
      {/* Profile stats bar */}
      {stats && strength && (
        <div className="mb-3">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex w-full items-center gap-3 rounded-xl bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800/80"
          >
            {/* Progress ring */}
            <div className="relative h-9 w-9 shrink-0">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#27272a" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={strength.color.replace("bg-", "stroke-")}
                  strokeDasharray={`${Math.min(100, (stats.likes + stats.dislikes) / 80 * 100)} 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                {stats.likes + stats.dislikes}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${strength.color}`} />
                <span className="text-xs font-medium text-zinc-300">
                  Профиль: {strength.label}
                </span>
                {stats.strongMatchCount > 0 && (
                  <span className="ml-auto text-xs text-zinc-500">
                    {stats.strongMatchCount} сильных совпадений
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">{strength.hint}</p>
            </div>

            <svg className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${showStats ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded stats */}
          {showStats && (
            <div className="mt-1.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">{stats.likes}</div>
                  <div className="text-[11px] text-zinc-500">Лайков</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{stats.dislikes}</div>
                  <div className="text-[11px] text-zinc-500">Дизлайков</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-zinc-400">{stats.skips}</div>
                  <div className="text-[11px] text-zinc-500">Скипов</div>
                </div>
              </div>

              {stats.topGenres.length > 0 && (
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <div className="text-[11px] text-zinc-500">Твои топ жанры</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {stats.topGenres.map((g) => (
                      <span key={g} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <SwipeCard anime={queue[0]} onSwiped={handleSwiped} />
    </div>
  );
}
