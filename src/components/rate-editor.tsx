"use client";

import { useState, useTransition } from "react";
import { updateRate } from "@/actions/rate";
import type { UserRateStatus } from "@/lib/types";

const statuses: { value: UserRateStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export function RateEditor({
  animeId,
  currentScore,
  currentStatus,
}: {
  animeId: number;
  currentScore: number;
  currentStatus: string | null;
}) {
  const [score, setScore] = useState(currentScore);
  const [status, setStatus] = useState(currentStatus ?? "planned");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          startTransition(async () => {
            await updateRate(animeId, {
              score,
              status: e.target.value as UserRateStatus,
            });
          });
        }}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
      >
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={score}
        onChange={(e) => {
          const newScore = parseInt(e.target.value);
          setScore(newScore);
          startTransition(async () => {
            await updateRate(animeId, {
              score: newScore,
              status: status as UserRateStatus,
            });
          });
        }}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
      >
        <option value={0}>—</option>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {isPending && <span className="text-xs text-zinc-500">saving...</span>}
    </div>
  );
}
