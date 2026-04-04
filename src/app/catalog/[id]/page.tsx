import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeById } from "@/actions/recommend";

export default async function AnimeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const anime = await getAnimeById(parseInt(params.id));
  if (!anime) notFound();

  return (
    <div className="px-4 pb-8 pt-4">
      <Link
        href="/catalog"
        className="mb-4 inline-block text-sm text-zinc-400 hover:text-white"
      >
        ← Catalog
      </Link>
      <div className="flex gap-4">
        <div className="relative aspect-[3/4] w-32 flex-shrink-0 overflow-hidden rounded-lg">
          {anime.image_url ? (
            <Image
              src={anime.image_url}
              alt={anime.russian ?? anime.name}
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-xs">
              No image
            </div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">
            {anime.russian ?? anime.name}
          </h1>
          {anime.russian && (
            <p className="mt-0.5 text-sm text-zinc-400">{anime.name}</p>
          )}
          <div className="mt-2 space-y-1 text-sm text-zinc-400">
            {anime.score && (
              <p>
                ★ {anime.score.toFixed(1)}{" "}
                <span className="text-zinc-600">Shikimori</span>
              </p>
            )}
            <p className="uppercase">{anime.kind}</p>
            {anime.episodes && <p>{anime.episodes} episodes</p>}
            {anime.duration && <p>{anime.duration} min/ep</p>}
            {anime.aired_on && (
              <p>{new Date(anime.aired_on).getFullYear()}</p>
            )}
            {anime.rating && <p>{anime.rating.toUpperCase()}</p>}
          </div>
          {anime.user_rate && (
            <div className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs">
              <span className="text-zinc-400">Your score: </span>
              <span className="text-white">
                {anime.user_rate.score > 0 ? anime.user_rate.score : "—"}
              </span>
              <span className="ml-2 text-zinc-400">
                {anime.user_rate.status}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {anime.genres.map((g) => (
          <span
            key={g.id}
            className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
          >
            {g.russian ?? g.name}
          </span>
        ))}
      </div>
      {anime.studios.length > 0 && (
        <div className="mt-3 text-sm text-zinc-400">
          Studio: {anime.studios.map((s) => s.name).join(", ")}
        </div>
      )}
      {anime.description && (
        <div className="mt-4 text-sm leading-relaxed text-zinc-300">
          {anime.description.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "")}
        </div>
      )}
      {anime.shikimori_url && (
        <a
          href={anime.shikimori_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Open on Shikimori →
        </a>
      )}
    </div>
  );
}
