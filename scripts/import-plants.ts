// SPEC-006: loads SPEC-001's scraped seed file into the `plants` table.
// Idempotent — safe to re-run as the seed set grows, since it upserts on
// scientific_name rather than blindly inserting.
//   npx tsx scripts/import-plants.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { PlantRecord } from "./lib/parse-rhs";

const SEED_FILE = path.join(__dirname, "seed", "plants-seed.json");

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toRow(plant: PlantRecord) {
  return {
    scientific_name: plant.scientificName,
    common_name: plant.commonName,
    synonyms: plant.synonyms,
    description: plant.description,
    image_url: plant.imageUrl,
    source: plant.source,
    source_url: plant.sourceUrl,
    family: plant.family,
    genus: plant.genus,
    habit: plant.habit,
    plant_types: plant.plantTypes,
    foliage: plant.foliage,
    native_gb: plant.nativeGb,
    soil_types: plant.soilTypes,
    moisture: plant.moisture,
    ph: plant.ph,
    position: plant.position,
    aspect: plant.aspect,
    exposure: plant.exposure,
    hardiness: plant.hardiness,
    height_range: plant.heightRange,
    spread_range: plant.spreadRange,
    geo_tags: plant.geoTags,
  };
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // already in the environment (e.g. CI) — fine.
  }

  const raw = await readFile(SEED_FILE, "utf-8");
  const plants: PlantRecord[] = JSON.parse(raw);
  console.log(`Importing ${plants.length} plants from ${path.relative(process.cwd(), SEED_FILE)}...`);

  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const rows = plants.map(toRow);

  // why: chunked, not one giant upsert — keeps a single request well within
  // Supabase's request size limits and gives visible progress on a seed of
  // this size.
  const CHUNK_SIZE = 50;
  let imported = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("plants").upsert(chunk, { onConflict: "scientific_name" });
    if (error) throw new Error(`Upsert failed at offset ${i}: ${error.message}`);
    imported += chunk.length;
    console.log(`  ${imported}/${rows.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
