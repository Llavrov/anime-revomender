"use server";

import { supabase } from "@/lib/supabase";
import type { UserRateStatus } from "@/lib/types";

export async function updateRate(
  animeId: number,
  updates: { score?: number; status?: UserRateStatus }
) {
  const { error } = await supabase.from("user_rates").upsert(
    {
      anime_id: animeId,
      ...updates,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "anime_id" }
  );

  if (error) throw new Error(`Failed to update rate: ${error.message}`);
}
