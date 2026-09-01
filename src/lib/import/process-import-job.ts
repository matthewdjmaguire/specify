import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPlantUrls, urlsForGenus } from "../../../scripts/lib/sitemap";
import { parsePlantPage, type PlantRecord } from "../../../scripts/lib/parse-rhs";

// why 350ms, matching the original CLI scraper exactly: this is the one
// number the standing RHS-load/legal-risk note in the app's Decision Log
// actually depends on — an admin-triggered job must be no heavier per
// request than the manual process it's replacing.
const REQUEST_DELAY_MS = 350;
// why bounded per tick, not "process the whole job" in one call: a job is
// driven by the admin page calling this repeatedly (every few seconds)
// while it's open, not a single request — Vercel Cron would be the more
// obvious fit, but per-minute schedules need a paid plan tier this project
// doesn't have, and client-driven ticks turn out faster anyway (a few
// seconds apart vs. once a minute) as long as the admin leaves the tab open.
const URLS_PER_TICK = 8;

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

// why processes exactly one job, one tick, per call: the admin page's tick
// server action calls this once per invocation against whichever job is
// oldest and unfinished — simpler to reason about than a single function
// juggling multiple jobs' worth of state.
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

  // why fetched once per tick, not scoped by genus column: a second/third
  // top-up job for a genus that already has plants would otherwise
  // re-encounter the same early candidates every time (each job walks
  // candidateUrls from index 0 again) and, since upsert-on-conflict
  // "succeeds" whether it's a real insert or a no-op update, trivially
  // satisfy a small target_count by re-touching plants it already has —
  // never making real progress into fresh candidates. Found via a category
  // top-up round that queued 63 jobs but grew the catalogue by only 1
  // plant. Deliberately not filtered by `.eq("genus", job.genus)` — a first
  // attempt at this fix did exactly that and silently matched zero rows,
  // because job.genus is the lowercase RHS slug ("clematis") while the
  // stored `plants.genus` column is properly-cased ("Clematis"); confirmed
  // live (`select genus from plants where genus ilike 'clematis'` returned
  // "Clematis") after a second top-up round showed jobs reporting
  // imported=3/3 with zero net growth in the plants table. scientific_name
  // is the upsert's actual conflict target and is globally unique, so a
  // full-table fetch is both correct and (at catalogue-seed scale) cheap.
  const { data: existingRows } = await supabase.from("plants").select("scientific_name");
  const existingNames = new Set((existingRows ?? []).map((r) => r.scientific_name as string));

  for (; index < endIndex && importedCount < job.target_count; index++) {
    const url = candidateUrls[index];
    if (index > job.next_candidate_index) await sleep(REQUEST_DELAY_MS);

    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      fetchedCount++;
      if (!res.ok) continue;
      const html = await res.text();
      const plant = parsePlantPage(html, url);
      // why skipping plants with no image, not just parsing gracefully:
      // RHS's own sitemap mixes well-documented plant pages with thin
      // "database stub" cultivar pages that carry a name and nothing else
      // (no real description, no photo) — found via a live report that a
      // 100-plant Camellia import was 87% cards with no image. A record
      // this bare isn't worth surfacing as a real catalogue entry, so it's
      // skipped (not counted toward the job's target) rather than imported.
      if (!plant || !plant.imageUrl) continue;
      // why skipped, not just left to upsert harmlessly: counting an
      // already-known plant toward the target is what caused the stall
      // described above — this makes target_count mean "N *new* plants",
      // matching what an admin actually means by "top up".
      if (existingNames.has(plant.scientificName)) continue;

      const { error } = await supabase.from("plants").upsert(toRow(plant), { onConflict: "scientific_name" });
      if (!error) {
        importedCount++;
        existingNames.add(plant.scientificName);
      }
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
