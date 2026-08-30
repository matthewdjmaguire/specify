"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SearchThemeResult = { id: string; displayName: string };
export type SearchPlantResult = {
  id: string;
  scientificName: string;
  commonName: string | null;
  sourceUrl: string | null;
};
export type SearchResults = { themes: SearchThemeResult[]; plants: SearchPlantResult[] };

const RESULT_LIMIT = 5;
const EMPTY: SearchResults = { themes: [], plants: [] };

type PlantRow = { id: string; scientific_name: string; common_name: string | null; source_url: string | null };

// why two separate ilike() calls merged client-side, not one .or(...): the
// .or() filter takes a raw PostgREST filter string that isn't safely escaped
// for embedded commas/parens — a search term containing either would corrupt
// the filter syntax. A plain .ilike() value is passed as a normal parameter
// (query-string encoded), so it has no such issue.
async function searchPlants(supabase: SupabaseClient, term: string): Promise<SearchPlantResult[]> {
  const columns = "id, scientific_name, common_name, source_url";
  const [{ data: byScientific }, { data: byCommon }] = await Promise.all([
    supabase.from("plants").select(columns).ilike("scientific_name", `%${term}%`).limit(RESULT_LIMIT),
    supabase.from("plants").select(columns).ilike("common_name", `%${term}%`).limit(RESULT_LIMIT),
  ]);

  const merged = new Map<string, PlantRow>();
  for (const row of [...((byScientific ?? []) as PlantRow[]), ...((byCommon ?? []) as PlantRow[])]) {
    merged.set(row.id, row);
  }
  return [...merged.values()].slice(0, RESULT_LIMIT).map((p) => ({
    id: p.id,
    scientificName: p.scientific_name,
    commonName: p.common_name,
    sourceUrl: p.source_url,
  }));
}

export async function searchAllCore(supabase: SupabaseClient, query: string): Promise<SearchResults> {
  const term = query.trim();
  if (term.length < 2) return EMPTY;

  const [{ data: themeRows }, plants] = await Promise.all([
    supabase
      .from("quiz_themes")
      .select("id, display_name")
      .eq("is_favourites", false)
      .ilike("display_name", `%${term}%`)
      .order("display_name")
      .limit(RESULT_LIMIT),
    searchPlants(supabase, term),
  ]);

  return {
    themes: (themeRows ?? []).map((t) => ({ id: t.id, displayName: t.display_name })),
    plants,
  };
}

export async function searchAll(query: string): Promise<SearchResults> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  return searchAllCore(supabase, query);
}
