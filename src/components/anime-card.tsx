"use client";

import { useTransition, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { RecommendedAnime, Reaction } from "@/lib/types";
import { markWatched } from "@/actions/rate";
import { recordSwipe } from "@/actions/swipe";

const KIND_LABELS: Record<string, string> = {
  tv: "Сериал",
  movie: "Фильм",
  ova: "OVA",
  ona: "ONA",
  special: "Спецвыпуск",
};

export function AnimeCard({
  anime,
  onHideCard,
}: {
  anime: RecommendedAnime;
  onHideCard?: (animeId: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [currentReaction, setCurrentReaction] = useState<Reaction | null>(
    anime.user_rate?.reaction ?? null
  );
  const [markedWatched, setMarkedWatched] = useState(false);
  const isWatched = anime.user_rate?.status === "completed" || markedWatched;

  function handleMarkWatched(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMarkedWatched(true);
    onHideCard?.(anime.id);
    startTransition(async () => {
      await markWatched(anime.id);
    });
  }

  function handleNotToday(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onHideCard?.(anime.id);
    startTransition(async () => {
      await recordSwipe(anime.id, "not_today");
    });
  }

  function handleReaction(e: React.MouseEvent, reaction: Reaction) {
    e.preventDefault();
    e.stopPropagation();
    const newReaction = currentReaction === reaction ? null : reaction;
    setCurrentReaction(newReaction);
    // Only hide on dislike; likes stay visible
    if (reaction === "dislike" && currentReaction !== "dislike") {
      onHideCard?.(anime.id);
    }
    startTransition(async () => {
      await recordSwipe(anime.id, newReaction ?? "skip");
    });
  }

  return (
    <Link href={`/catalog/${anime.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
        {anime.image_url ? (
          <Image
            src={anime.image_url}
            alt={anime.russian ?? anime.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-xs">
            No image
          </div>
        )}
        {anime.score && (
          <div className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-yellow-400">
            ★ {anime.score.toFixed(1)}
          </div>
        )}

        {/* Watched badge or mark-as-watched button */}
        {isWatched ? (
          <div className="absolute right-1.5 top-1.5 rounded bg-green-600/80 px-1.5 py-0.5 text-xs font-medium text-white">
            ✓ Смотрел
          </div>
        ) : (
          <button
            onClick={handleMarkWatched}
            disabled={isPending}
            className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs text-zinc-300 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 disabled:opacity-50"
          >
            {isPending ? "..." : "Смотрел"}
          </button>
        )}

        {/* Actions overlay at bottom */}
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handleNotToday}
            disabled={isPending}
            className="flex h-7 items-center justify-center rounded-full bg-black/60 px-2 text-[10px] text-zinc-300 hover:bg-zinc-600 hover:text-white"
            title="Не сегодня"
          >
            Потом
          </button>
          <button
            onClick={(e) => handleReaction(e, "dislike")}
            disabled={isPending}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
              currentReaction === "dislike"
                ? "bg-red-500 text-white"
                : "bg-black/60 text-zinc-300 hover:bg-red-500/80 hover:text-white"
            }`}
          >
            ✕
          </button>
          <button
            onClick={(e) => handleReaction(e, "like")}
            disabled={isPending}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
              currentReaction === "like"
                ? "bg-green-500 text-white"
                : "bg-black/60 text-zinc-300 hover:bg-green-500/80 hover:text-white"
            }`}
          >
            ♥
          </button>
        </div>

        {/* User score if exists */}
        {anime.user_rate && anime.user_rate.score > 0 && (
          <div className="absolute left-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-blue-400">
            Моя: {anime.user_rate.score}
          </div>
        )}
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-tight text-zinc-200">
        {anime.russian ?? anime.name}
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        {KIND_LABELS[anime.kind] ?? anime.kind?.toUpperCase()}
        {anime.aired_on && ` · ${new Date(anime.aired_on).getFullYear()}`}
      </p>
    </Link>
  );
}
