"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminDirectoryEntry = {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
};

// why this just calls the RPC with no extra admin check here: the
// admin_user_directory() function (SPEC-021 migration) is itself the
// enforcement point — `where public.is_admin()` inside it means a non-admin
// caller gets zero rows back, and its fixed return type means quiz data can
// never leak through it regardless of what a caller asks for.
export async function getAdminDirectoryCore(supabase: SupabaseClient): Promise<AdminDirectoryEntry[]> {
  const { data, error } = await supabase.rpc("admin_user_directory");
  if (error) throw error;
  return (
    (data ?? []) as Array<{
      id: string;
      display_name: string;
      email: string;
      is_admin: boolean;
      is_primary_admin: boolean;
    }>
  ).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    isAdmin: row.is_admin,
    isPrimaryAdmin: row.is_primary_admin,
  }));
}

export async function getAdminDirectory(): Promise<AdminDirectoryEntry[]> {
  const supabase = await createClient();
  return getAdminDirectoryCore(supabase);
}

// why check the acting user's admin status here in application code, not
// just rely on RLS: the actual mutation below runs on a service-role client
// (profiles RLS only ever allows a user to update their own row, so changing
// someone else's is_admin has no RLS path at all) — this function is the
// only thing standing between "any signed-in user" and that service-role
// write, so it has to be the real gate, re-checked from the database on
// every call rather than trusted from the caller.
async function requireActingAdmin(actingClient: SupabaseClient, actingUserId: string): Promise<void> {
  const { data: actingProfile } = await actingClient
    .from("profiles")
    .select("is_admin")
    .eq("id", actingUserId)
    .single();
  if (!actingProfile?.is_admin) throw new Error("Admin access required");
}

export async function setUserAdminCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  targetUserId: string,
  isAdmin: boolean,
): Promise<void> {
  await requireActingAdmin(actingClient, actingUserId);

  if (targetUserId === actingUserId && !isAdmin) {
    throw new Error("You cannot remove your own admin access");
  }

  const service = createServiceRoleClient();
  const { data: target } = await service
    .from("profiles")
    .select("is_primary_admin")
    .eq("id", targetUserId)
    .single();
  if (target?.is_primary_admin && !isAdmin) {
    // The profiles_guard trigger blocks this at the database level too
    // (even for service-role) — this check exists to fail with a clear
    // message instead of a raw Postgres exception.
    throw new Error("The primary admin cannot be demoted");
  }

  const { error } = await service.from("profiles").update({ is_admin: isAdmin }).eq("id", targetUserId);
  if (error) throw error;
}

export async function setUserAdmin(targetUserId: string, isAdmin: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  await setUserAdminCore(supabase, user.id, targetUserId, isAdmin);
  revalidatePath("/admin");
}

export async function deleteUserCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  await requireActingAdmin(actingClient, actingUserId);

  const service = createServiceRoleClient();
  const { data: target } = await service
    .from("profiles")
    .select("is_primary_admin")
    .eq("id", targetUserId)
    .single();
  if (target?.is_primary_admin) {
    // Also blocked at the database level (profiles_guard_delete) — same
    // reasoning as above.
    throw new Error("The primary admin cannot be deleted");
  }

  // auth.admin.deleteUser cascades to profiles (on delete cascade), which
  // cascades to quiz_attempts/quiz_questions/plant_stats/personal
  // quiz_themes via their own FKs.
  const { error } = await service.auth.admin.deleteUser(targetUserId);
  if (error) throw error;
}

export async function deleteUser(targetUserId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  await deleteUserCore(supabase, user.id, targetUserId);
  revalidatePath("/admin");
}
