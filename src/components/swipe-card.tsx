"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { RecommendedAnime, Reaction } from "@/lib/types";
import { recordSwipe } from "@/actions/swipe";

export function SwipeCard({
  anime,
  onSwiped,
}: {
  anime: RecommendedAnime;
  onSwiped: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  function handleSwipe(reaction: Reaction) {
    const direction = reaction === "like" ? "right" : reaction === "dislike" ? "left" : null;
    setExiting(direction);

    startTransition(async () => {
      await recordSwipe(anime.id, reaction);
      setTimeout(() => {
        setExiting(null);
        onSwiped();
      }, 200);
    });
  }

  return (
    <div
      className={`flex flex-col transition-all duration-200 ${
        exiting === "left"
          ? "-translate-x-full opacity-0"
          : exiting === "right"
            ? "translate-x-full opacity-0"
            : ""
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl">
        {anime.image_url ? (
          <Image
            src={anime.image_url}
            alt={anime.russian ?? anime.name}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-500">
            No image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-xl font-bold leading-tight">
            {anime.russian ?? anime.name}
          </h2>
          {anime.russian && (
            <p className="mt-0.5 text-sm text-zinc-400">{anime.name}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {anime.genres.slice(0, 4).map((g) => (
              <span
                key={g.id}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-zinc-300"
              >
                {g.russian ?? g.name}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
            {anime.score && <span>★ {anime.score.toFixed(1)}</span>}
            {anime.kind && <span className="uppercase">{anime.kind}</span>}
            {anime.episodes && <span>{anime.episodes} эп.</span>}
          </div>
        </div>
      </div>
      {anime.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
          {anime.description.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "")}
        </p>
      )}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={() => handleSwipe("dislike")}
          disabled={isPending}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 text-2xl text-red-400 transition-all hover:border-red-500 hover:bg-red-500/10 active:scale-90 disabled:opacity-50"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe("skip")}
          disabled={isPending}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-zinc-600/30 text-lg text-zinc-500 transition-all hover:border-zinc-500 hover:bg-zinc-500/10 active:scale-90 disabled:opacity-50"
        >
          →
        </button>
        <button
          onClick={() => handleSwipe("like")}
          disabled={isPending}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/30 text-2xl text-green-400 transition-all hover:border-green-500 hover:bg-green-500/10 active:scale-90 disabled:opacity-50"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
