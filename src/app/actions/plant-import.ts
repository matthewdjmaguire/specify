"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processImportJobTick } from "@/lib/import/process-import-job";

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
