import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizPlant } from "./types";

// why exported (PLANT_COLUMNS, PlantRow, toQuizPlant): this was the second
// place in the app to hand-write "select these plant columns, map snake_case
// to QuizPlant" (the attempt page had its own copy) — consolidated here as
// the one source of truth so a new field (like sourceUrl) only needs adding
// once.
export const PLANT_COLUMNS =
  "id, scientific_name, common_name, description, image_url, source_url, family, genus, habit, foliage, soil_types, moisture, ph, position, aspect, exposure, hardiness, height_range, spread_range, geo_tags";

export type PlantRow = {
  id: string;
  scientific_name: string;
  common_name: string | null;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  family: string | null;
  genus: string | null;
  habit: string | null;
  foliage: string | null;
  soil_types: string[];
  moisture: string | null;
  ph: string | null;
  position: string[];
  aspect: string | null;
  exposure: string | null;
  hardiness: string | null;
  height_range: string | null;
  spread_range: string | null;
};

export function toQuizPlant(row: PlantRow): QuizPlant {
  return {
    id: row.id,
    scientificName: row.scientific_name,
    commonName: row.common_name,
    description: row.description,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    family: row.family,
    genus: row.genus,
    habit: row.habit,
    foliage: row.foliage,
    soilTypes: row.soil_types,
    moisture: row.moisture,
    ph: row.ph,
    position: row.position,
    aspect: row.aspect,
    exposure: row.exposure,
    hardiness: row.hardiness,
    heightRange: row.height_range,
    spreadRange: row.spread_range,
  };
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

// why length >= 3, both here and on haystack words below: drops stopwords
// ("in", "or", "a") from consideration on both sides of the match — without
// this, a short haystack word like "or" (from a pH value like "Acid or
// Neutral") would substring-match all sorts of unrelated longer keywords.
function tokenize(text: string): string[] {
  return [...new Set(words(text))].filter((w) => w.length >= 3);
}

function haystackWords(plant: QuizPlant): string[] {
  const raw = [
    plant.scientificName,
    plant.commonName,
    plant.description,
    plant.family,
    plant.genus,
    plant.habit,
    plant.foliage,
    ...plant.soilTypes,
    plant.moisture,
    plant.ph,
    ...plant.position,
    plant.aspect,
    plant.exposure,
    plant.hardiness,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");
  return words(raw).filter((w) => w.length >= 3);
}

// why a plain keyword match, not an LLM call: explicitly out of scope per
// the charter — v1 filters against real structured fields (soil, position,
// hardiness, etc. as well as name/family/genus/description).
//
// why bidirectional word-level substring matching, not a single
// haystack.includes(keyword) check: a first version required the *haystack*
// to contain the full keyword, which silently failed the common case of a
// plural prompt matching a singular field — "trees" (keyword, 5 chars)
// is not found inside "tree" (a habit value, 4 chars), because the shorter
// string can never contain the longer one. Checking both directions (does
// either word contain the other) fixes "trees"->"tree" while still being a
// few lines of substring logic, not real stemming/NLP.
export function filterPlantsByPrompt(plants: QuizPlant[], prompt: string): QuizPlant[] {
  const keywords = tokenize(prompt);
  if (keywords.length === 0) return plants;

  return plants.filter((plant) => {
    const hWords = haystackWords(plant);
    return keywords.some((kw) => hWords.some((hw) => hw.includes(kw) || kw.includes(hw)));
  });
}

export async function resolveThemePlants(
  supabase: SupabaseClient,
  theme: { prompt: string; isLuckyDip: boolean },
  geoScope: "UK" | "Global",
): Promise<QuizPlant[]> {
  let query = supabase.from("plants").select(PLANT_COLUMNS);
  if (geoScope === "UK") {
    // why .contains, not .eq: geo_tags is an array (a plant can be both
    // "UK" and "Global"-tagged) — UK scope means "tagged UK", not
    // "tagged UK and nothing else".
    query = query.contains("geo_tags", ["UK"]);
  }

  const { data, error } = await query;
  if (error) throw error;

  const plants = ((data ?? []) as PlantRow[]).map(toQuizPlant);

  // Lucky Dip (and any theme saved with a blank prompt) means "no filter".
  if (theme.isLuckyDip || !theme.prompt.trim()) {
    return plants;
  }

  return filterPlantsByPrompt(plants, theme.prompt);
}
