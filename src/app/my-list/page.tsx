"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getMyList } from "@/actions/recommend";
import { RateEditor } from "@/components/rate-editor";
import type { AnimeWithRelations } from "@/lib/types";

const tabs = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

export default function MyListPage() {
  const [anime, setAnime] = useState<AnimeWithRelations[]>([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getMyList(tab || undefined);
    setAnime(data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-lg font-bold">My List</h1>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
              tab === t.value
                ? "bg-white text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="mt-12 text-center text-zinc-500">Loading...</div>
      ) : (
        <div className="mt-4 space-y-3">
          {anime.map((a) => (
            <div key={a.id} className="flex gap-3 rounded-lg bg-zinc-900 p-2.5">
              <Link
                href={`/catalog/${a.id}`}
                className="relative aspect-[3/4] w-16 flex-shrink-0 overflow-hidden rounded"
              >
                {a.image_url ? (
                  <Image
                    src={a.image_url}
                    alt={a.russian ?? a.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-zinc-800 text-zinc-600 text-[10px]">
                    ?
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col justify-between">
                <Link href={`/catalog/${a.id}`}>
                  <h3 className="line-clamp-1 text-sm font-medium text-zinc-200">
                    {a.russian ?? a.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {a.kind?.toUpperCase()}
                    {a.score && ` · ★ ${a.score.toFixed(1)}`}
                    {a.episodes && ` · ${a.episodes} эп.`}
                  </p>
                </Link>
                <RateEditor
                  animeId={a.id}
                  currentScore={a.user_rate?.score ?? 0}
                  currentStatus={a.user_rate?.status ?? null}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && anime.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">No anime in this list</div>
      )}
    </div>
  );
}
