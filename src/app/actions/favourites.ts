"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLANT_COLUMNS, toQuizPlant, type PlantRow } from "@/lib/quiz/resolve-theme-plants";
import type { QuizPlant } from "@/lib/quiz/types";

// why fetch-then-upsert-the-full-row, not relying on ON CONFLICT column
// omission: matches recordPlantMasteryCore's own pattern in plant-stats.ts
// — explicit about what every column ends up as, rather than trusting
// upsert semantics to leave times_seen/priority_weight etc. untouched.
export async function toggleFavouriteCore(
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  isFavourite: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from("plant_stats")
    .select("times_seen, times_correct, times_incorrect, priority_weight, last_seen_at")
    .eq("user_id", userId)
    .eq("plant_id", plantId)
    .maybeSingle();

  const { error } = await supabase.from("plant_stats").upsert(
    {
      user_id: userId,
      plant_id: plantId,
      times_seen: existing?.times_seen ?? 0,
      times_correct: existing?.times_correct ?? 0,
      times_incorrect: existing?.times_incorrect ?? 0,
      priority_weight: existing?.priority_weight ?? 1,
      last_seen_at: existing?.last_seen_at ?? null,
      is_favourite: isFavourite,
    },
    { onConflict: "user_id,plant_id" },
  );
  if (error) throw error;
}

export async function toggleFavourite(plantId: string, isFavourite: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  await toggleFavouriteCore(supabase, user.id, plantId, isFavourite);
  revalidatePath("/favourites");
}

export async function getFavouritePlantIdsCore(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("plant_stats")
    .select("plant_id")
    .eq("user_id", userId)
    .eq("is_favourite", true);
  if (error) throw error;
  return (data ?? []).map((row) => row.plant_id as string);
}

// why a plain userId-scoped query, not the caller's own session inside
// Core: quiz attempt pages call this alongside several other
// already-parallelised queries (Promise.all) — taking the client/userId as
// params (like every other Core function here) keeps it usable the same
// way rather than each call site needing its own auth lookup.
export async function getFavouritePlantIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getFavouritePlantIdsCore(supabase, user.id);
}

export async function getFavouritedPlantsCore(supabase: SupabaseClient, userId: string): Promise<QuizPlant[]> {
  const { data, error } = await supabase
    .from("plant_stats")
    .select(`plant_id, plants(${PLANT_COLUMNS})`)
    .eq("user_id", userId)
    .eq("is_favourite", true);
  if (error) throw error;

  const plants = ((data ?? []) as unknown as Array<{ plants: PlantRow }>).map((row) => toQuizPlant(row.plants));
  return plants.sort((a, b) => a.scientificName.localeCompare(b.scientificName));
}

export async function getFavouritedPlants(): Promise<QuizPlant[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getFavouritedPlantsCore(supabase, user.id);
}

// why get-or-create rather than provisioning this at signup: quiz_attempts
// needs a real theme_id to reference (it's a required FK), but not every
// user will ever use "Quiz me on my Favourites" — creating it lazily, on
// first use, avoids a theme row for users who never touch the feature. The
// partial unique index on (owner_id) where is_favourites makes the insert
// safe under a race (two concurrent first-uses) — the loser's insert just
// fails and re-reads the winner's row.
export async function getOrCreateFavouritesThemeCore(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("quiz_themes")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_favourites", true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("quiz_themes")
    .insert({ display_name: "My Favourites", prompt: "", owner_id: userId, is_global: false, is_favourites: true })
    .select("id")
    .single();
  if (!error) return created.id;

  const { data: afterRace } = await supabase
    .from("quiz_themes")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_favourites", true)
    .single();
  if (afterRace) return afterRace.id;
  throw error;
}

export async function getOrCreateFavouritesTheme(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return getOrCreateFavouritesThemeCore(supabase, user.id);
}
