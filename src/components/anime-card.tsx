import Image from "next/image";
import Link from "next/link";
import type { RecommendedAnime } from "@/lib/types";

export function AnimeCard({ anime }: { anime: RecommendedAnime }) {
  return (
    <Link href={`/catalog/${anime.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
        {anime.image_url ? (
          <Image
            src={anime.image_url}
            alt={anime.russian ?? anime.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 448px) 50vw, 200px"
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
        {anime.user_rate && (
          <div className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-green-400">
            {anime.user_rate.score > 0 ? anime.user_rate.score : "✓"}
          </div>
        )}
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-tight text-zinc-200">
        {anime.russian ?? anime.name}
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        {anime.kind?.toUpperCase()}
        {anime.aired_on && ` · ${new Date(anime.aired_on).getFullYear()}`}
      </p>
    </Link>
  );
}
