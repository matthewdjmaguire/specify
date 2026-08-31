"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processImportJobTick } from "@/lib/import/process-import-job";
import { GENUS_CATEGORIES, allGenera } from "../../../scripts/lib/genus-list";

export type ImportJob = {
  id: string;
  genus: string;
  targetCount: number;
  status: "pending" | "running" | "done" | "failed";
  fetchedCount: number;
  importedCount: number;
  errorMessage: string | null;
  createdAt: string;
};

async function requireActingAdmin(actingClient: SupabaseClient, actingUserId: string): Promise<void> {
  const { data: actingProfile } = await actingClient
    .from("profiles")
    .select("is_admin")
    .eq("id", actingUserId)
    .single();
  if (!actingProfile?.is_admin) throw new Error("Admin access required");
}

const GENUS_SLUG_PATTERN = /^[a-z]+$/;

export async function createImportJobCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  genus: string,
  targetCount: number,
): Promise<void> {
  await requireActingAdmin(actingClient, actingUserId);

  const normalisedGenus = genus.trim().toLowerCase();
  if (!GENUS_SLUG_PATTERN.test(normalisedGenus)) {
    throw new Error("Genus must be a single lowercase word (e.g. \"camellia\") — that's how RHS slugs its URLs.");
  }
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 100) {
    throw new Error("Target count must be between 1 and 100.");
  }

  const { error } = await actingClient
    .from("plant_import_jobs")
    .insert({ requested_by: actingUserId, genus: normalisedGenus, target_count: targetCount });
  if (error) throw error;
}

export async function createImportJob(genus: string, targetCount: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  await createImportJobCore(supabase, user.id, genus, targetCount);
  revalidatePath("/admin");
}

// why genera already at/above the target are skipped, not just re-queued
// unconditionally: this is a "top up", not a "re-run everything" — a genus
// already well-stocked would just re-upsert (mostly) the same rows it
// already has, wasting RHS requests for zero real growth. Genera with an
// existing pending/running job are skipped too, so clicking this twice in a
// row doesn't double-queue the same work.
export async function createBulkImportJobsCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  targetCountPerGenus: number,
): Promise<{ queuedCount: number; skippedCount: number }> {
  await requireActingAdmin(actingClient, actingUserId);

  if (!Number.isInteger(targetCountPerGenus) || targetCountPerGenus < 1 || targetCountPerGenus > 100) {
    throw new Error("Target count must be between 1 and 100.");
  }

  const service = createServiceRoleClient();

  // why counted in JS, not a group-by RPC: the catalogue is small enough
  // (hundreds, not millions, of rows) that fetching just the genus column
  // and tallying it here is simpler than adding a new DB function for one
  // caller.
  const { data: genusRows, error: countError } = await service.from("plants").select("genus").not("genus", "is", null);
  if (countError) throw countError;
  const currentCounts = new Map<string, number>();
  for (const row of genusRows ?? []) {
    const key = (row.genus as string).toLowerCase();
    currentCounts.set(key, (currentCounts.get(key) ?? 0) + 1);
  }

  const { data: existingJobs, error: jobsError } = await service
    .from("plant_import_jobs")
    .select("genus")
    .in("status", ["pending", "running"]);
  if (jobsError) throw jobsError;
  const genusesWithActiveJob = new Set((existingJobs ?? []).map((j) => j.genus));

  let queuedCount = 0;
  let skippedCount = 0;
  for (const genus of allGenera()) {
    const currentCount = currentCounts.get(genus) ?? 0;
    if (currentCount >= targetCountPerGenus || genusesWithActiveJob.has(genus)) {
      skippedCount++;
      continue;
    }
    const { error } = await service
      .from("plant_import_jobs")
      .insert({ requested_by: actingUserId, genus, target_count: targetCountPerGenus });
    if (error) throw error;
    queuedCount++;
  }

  return { queuedCount, skippedCount };
}

export async function createBulkImportJobs(targetCountPerGenus: number): Promise<{
  queuedCount: number;
  skippedCount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const result = await createBulkImportJobsCore(supabase, user.id, targetCountPerGenus);
  revalidatePath("/admin");
  return result;
}

// why per-category, not per-genus like createBulkImportJobsCore: "at least
// 100 trees" is what a quiz theme like "Trees" actually needs — a category
// with many genera can hit that total without every individual genus
// reaching 100 itself, so distributing the shortfall across whichever
// genera in the category don't already have a job running is a better fit
// than a flat per-genus target.
export async function ensureCategoryMinimumsCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  minPerCategory: number,
): Promise<{ queuedCount: number; skippedCount: number; categoriesNeedingWork: string[] }> {
  await requireActingAdmin(actingClient, actingUserId);

  if (!Number.isInteger(minPerCategory) || minPerCategory < 1) {
    throw new Error("Minimum per category must be a positive whole number.");
  }

  const service = createServiceRoleClient();

  const { data: genusRows, error: countError } = await service.from("plants").select("genus").not("genus", "is", null);
  if (countError) throw countError;
  const currentCounts = new Map<string, number>();
  for (const row of genusRows ?? []) {
    const key = (row.genus as string).toLowerCase();
    currentCounts.set(key, (currentCounts.get(key) ?? 0) + 1);
  }

  const { data: existingJobs, error: jobsError } = await service
    .from("plant_import_jobs")
    .select("genus")
    .in("status", ["pending", "running"]);
  if (jobsError) throw jobsError;
  const genusesWithActiveJob = new Set((existingJobs ?? []).map((j) => j.genus));

  let queuedCount = 0;
  let skippedCount = 0;
  const categoriesNeedingWork: string[] = [];

  for (const [category, genera] of Object.entries(GENUS_CATEGORIES)) {
    const categoryTotal = genera.reduce((sum, g) => sum + (currentCounts.get(g) ?? 0), 0);
    if (categoryTotal >= minPerCategory) continue;

    const shortfall = minPerCategory - categoryTotal;
    const availableGenera = genera.filter((g) => !genusesWithActiveJob.has(g));
    skippedCount += genera.length - availableGenera.length;
    if (availableGenera.length === 0) continue;

    categoriesNeedingWork.push(category);
    // why capped at 100 per job: matches every other import job's own
    // limit (createImportJobCore) — a huge shortfall spread over very few
    // available genera just means more jobs get queued later, not one job
    // exceeding the per-job cap.
    const perGenusTarget = Math.max(1, Math.min(100, Math.ceil(shortfall / availableGenera.length)));
    for (const genus of availableGenera) {
      const { error } = await service
        .from("plant_import_jobs")
        .insert({ requested_by: actingUserId, genus, target_count: perGenusTarget });
      if (error) throw error;
      queuedCount++;
    }
  }

  return { queuedCount, skippedCount, categoriesNeedingWork };
}

export async function ensureCategoryMinimums(minPerCategory: number): Promise<{
  queuedCount: number;
  skippedCount: number;
  categoriesNeedingWork: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const result = await ensureCategoryMinimumsCore(supabase, user.id, minPerCategory);
  revalidatePath("/admin");
  return result;
}

export async function getImportJobsCore(supabase: SupabaseClient): Promise<ImportJob[]> {
  const { data, error } = await supabase
    .from("plant_import_jobs")
    .select("id, genus, target_count, status, fetched_count, imported_count, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    genus: row.genus,
    targetCount: row.target_count,
    status: row.status,
    fetchedCount: row.fetched_count,
    importedCount: row.imported_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function getImportJobs(): Promise<ImportJob[]> {
  const supabase = await createClient();
  return getImportJobsCore(supabase);
}

// why service-role for the actual tick, not the acting admin's own
// session: `plants` has no INSERT/UPDATE RLS policy at all (only
// plants_select_all) — writing to it has only ever been possible via
// service-role, same as the original SPEC-001 import script. The admin
// gate above is what stands between "any signed-in user" and that
// privileged write, same pattern as admin.ts's setUserAdminCore.
export async function processNextImportJobTick(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await requireActingAdmin(supabase, user.id);

  const service = createServiceRoleClient();
  const { data: job, error } = await service
    .from("plant_import_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!job) return;

  if (job.status === "pending") {
    await service.from("plant_import_jobs").update({ status: "running" }).eq("id", job.id);
  }

  try {
    await processImportJobTick(service, job);
  } catch (err) {
    await service
      .from("plant_import_jobs")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Unknown error" })
      .eq("id", job.id);
  }

  revalidatePath("/admin");
}
