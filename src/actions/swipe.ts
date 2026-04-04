"use server";

import { supabase } from "@/lib/supabase";
import type { Reaction } from "@/lib/types";

export async function recordSwipe(animeId: number, reaction: Reaction) {
  const { error } = await supabase.from("user_rates").upsert(
    {
      anime_id: animeId,
      reaction,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "anime_id" }
  );

  if (error) throw new Error(`Failed to record swipe: ${error.message}`);
}
