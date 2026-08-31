"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PLANT_COLUMNS, toQuizPlant, type PlantRow } from "@/lib/quiz/resolve-theme-plants";
import type { QuizPlant } from "@/lib/quiz/types";

// why the whole catalogue, not geo-scoped: Browse is for exploring what's in
// the catalogue at all, not for building a quiz — the UK/Global toggle is a
// quiz-setup concept (resolveThemePlants), not a browsing one.
export async function getAllPlantsCore(supabase: SupabaseClient): Promise<QuizPlant[]> {
  const { data, error } = await supabase.from("plants").select(PLANT_COLUMNS);
  if (error) throw error;

  const plants = ((data ?? []) as PlantRow[]).map(toQuizPlant);
  return plants.sort((a, b) => a.scientificName.localeCompare(b.scientificName));
}

export async function getAllPlants(): Promise<QuizPlant[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getAllPlantsCore(supabase);
}
