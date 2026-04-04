"use client";

import { useEffect, useState, useCallback } from "react";
import { SwipeCard } from "@/components/swipe-card";
import { getRecommendations } from "@/actions/recommend";
import type { RecommendedAnime } from "@/lib/types";

export default function SwipePage() {
  const [queue, setQueue] = useState<RecommendedAnime[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    const recs = await getRecommendations(20);
    setQueue(recs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  function handleSwiped() {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length <= 3) {
        loadRecommendations();
      }
      return next;
    });
  }

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
    <div className="px-4 pt-4">
      <SwipeCard anime={queue[0]} onSwiped={handleSwiped} />
    </div>
  );
}
