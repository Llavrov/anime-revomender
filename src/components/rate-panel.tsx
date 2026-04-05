"use client";

import { useState, useTransition } from "react";
import type { Reaction, UserRate, UserRateStatus } from "@/lib/types";
import { recordSwipe } from "@/actions/swipe";
import { updateRate, markWatched } from "@/actions/rate";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STATUS_LABELS: Record<UserRateStatus, string> = {
  completed: "Просмотрено",
  watching: "Смотрю",
  planned: "Запланировано",
  on_hold: "Отложено",
  dropped: "Брошено",
};

export function RatePanel({
  animeId,
  initialRate,
}: {
  animeId: number;
  initialRate: UserRate | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [reaction, setReaction] = useState<Reaction | null>(initialRate?.reaction ?? null);
  const [score, setScore] = useState<number>(initialRate?.score ?? 0);
  const [status, setStatus] = useState<UserRateStatus | null>(initialRate?.status ?? null);

  function handleReaction(r: Reaction) {
    const newReaction = reaction === r ? null : r;
    setReaction(newReaction);
    startTransition(async () => {
      await recordSwipe(animeId, newReaction ?? "skip");
    });
  }

  function handleScore(s: number) {
    const newScore = score === s ? 0 : s;
    setScore(newScore);
    startTransition(async () => {
      await updateRate(animeId, { score: newScore });
    });
  }

  function handleStatus(s: UserRateStatus) {
    const newStatus = status === s ? null : s;
    setStatus(newStatus);
    if (s === "completed") {
      startTransition(async () => {
        await markWatched(animeId);
      });
    } else {
      startTransition(async () => {
        await updateRate(animeId, { status: s });
      });
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
      {/* Like / Dislike */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">Реакция</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleReaction("like")}
            disabled={isPending}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-all ${
              reaction === "like"
                ? "bg-green-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-green-500/20 hover:text-green-400"
            }`}
          >
            ♥
          </button>
          <button
            onClick={() => handleReaction("dislike")}
            disabled={isPending}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-all ${
              reaction === "dislike"
                ? "bg-red-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
            }`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Score */}
      <div>
        <span className="text-xs text-zinc-500">Оценка</span>
        <div className="mt-1.5 flex gap-1">
          {SCORES.map((s) => (
            <button
              key={s}
              onClick={() => handleScore(s)}
              disabled={isPending}
              className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-all ${
                score === s
                  ? s >= 8 ? "bg-green-500 text-white" : s >= 5 ? "bg-yellow-500 text-black" : "bg-red-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <span className="text-xs text-zinc-500">Статус</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(Object.entries(STATUS_LABELS) as [UserRateStatus, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleStatus(key)}
              disabled={isPending}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                status === key
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
