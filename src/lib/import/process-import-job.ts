import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPlantUrls, urlsForGenus } from "../../../scripts/lib/sitemap";
import { parsePlantPage, type PlantRecord } from "../../../scripts/lib/parse-rhs";

// why 350ms, matching the original CLI scraper exactly: this is the one
// number the standing RHS-load/legal-risk note in the app's Decision Log
// actually depends on — an admin-triggered job must be no heavier per
// request than the manual process it's replacing.
const REQUEST_DELAY_MS = 350;
// why bounded per tick, not "process the whole job": a serverless function
// has a real execution ceiling, and this runs on a repeating cron tick, so
// each invocation only needs to make forward progress, not finish the job.
const URLS_PER_TICK = 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

type JobRow = {
  id: string;
  genus: string;
  target_count: number;
  status: "pending" | "running" | "done" | "failed";
  candidate_urls: string[] | null;
  next_candidate_index: number;
  fetched_count: number;
  imported_count: number;
};

// why processes exactly one job, one tick, per call: the cron route calls
// this once per invocation against whichever job is oldest and unfinished —
// simpler to reason about than a single function juggling multiple jobs'
// worth of state.
export async function processImportJobTick(supabase: SupabaseClient, job: JobRow): Promise<void> {
  let candidateUrls = job.candidate_urls;
  if (candidateUrls === null) {
    const allEntries = await fetchAllPlantUrls();
    candidateUrls = urlsForGenus(allEntries, job.genus.toLowerCase());
    if (candidateUrls.length === 0) {
      await supabase
        .from("plant_import_jobs")
        .update({ status: "failed", error_message: `No RHS plant pages found for genus "${job.genus}".` })
        .eq("id", job.id);
      return;
    }
  }

  let fetchedCount = job.fetched_count;
  let importedCount = job.imported_count;
  let index = job.next_candidate_index;
  const endIndex = Math.min(index + URLS_PER_TICK, candidateUrls.length);

  for (; index < endIndex && importedCount < job.target_count; index++) {
    const url = candidateUrls[index];
    if (index > job.next_candidate_index) await sleep(REQUEST_DELAY_MS);

    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      fetchedCount++;
      if (!res.ok) continue;
      const html = await res.text();
      const plant = parsePlantPage(html, url);
      if (!plant) continue;

      const { error } = await supabase.from("plants").upsert(toRow(plant), { onConflict: "scientific_name" });
      if (!error) importedCount++;
    } catch {
      // one bad page shouldn't fail the whole job — skipped, counted as
      // fetched so the job still makes forward progress through the list.
    }
  }

  const exhausted = index >= candidateUrls.length;
  const targetReached = importedCount >= job.target_count;
  const status = targetReached || exhausted ? "done" : "running";

  await supabase
    .from("plant_import_jobs")
    .update({
      status,
      candidate_urls: candidateUrls,
      next_candidate_index: index,
      fetched_count: fetchedCount,
      imported_count: importedCount,
    })
    .eq("id", job.id);
}
