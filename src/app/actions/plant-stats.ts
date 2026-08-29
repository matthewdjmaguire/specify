"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { computeNextWeight } from "@/lib/quiz/plant-mastery";

// why split core/wrapper: same reason as every other action in this app —
// "use server" reads cookies via next/headers, which doesn't work in tests.
export async function recordPlantMasteryCore(
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  correct: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from("plant_stats")
    .select("times_seen, times_correct, times_incorrect, priority_weight")
    .eq("user_id", userId)
    .eq("plant_id", plantId)
    .maybeSingle();

  const currentWeight = existing?.priority_weight ?? 1;

  const { error } = await supabase.from("plant_stats").upsert(
    {
      user_id: userId,
      plant_id: plantId,
      times_seen: (existing?.times_seen ?? 0) + 1,
      times_correct: (existing?.times_correct ?? 0) + (correct ? 1 : 0),
      times_incorrect: (existing?.times_incorrect ?? 0) + (correct ? 0 : 1),
      priority_weight: computeNextWeight(currentWeight, correct),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plant_id" },
  );
  if (error) throw error;
}

// why only called for 'name' questions (see the runner): priority_weight
// drives SPEC-010's plant *selection* — the skill being spaced-repeated is
// "recognise this plant by name", not "recall one characteristic of it",
// so follow-up (SPEC-014) answers deliberately don't feed this.
export async function recordPlantMastery(plantId: string, correct: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  return recordPlantMasteryCore(supabase, user.id, plantId, correct);
}
