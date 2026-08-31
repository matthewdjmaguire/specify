"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendBrandedEmail } from "@/lib/email/send-branded-email";
import { escapeHtml } from "@/lib/email/branded-template";

const SIGN_IN_URL = "https://specify-seven.vercel.app/sign-in";

// why caught and logged, never rethrown: invite/delete are the real action
// here — already fully functional without email. A notification that fails
// to send (e.g. RESEND_API_KEY not yet provisioned) shouldn't block the
// admin action itself; it should just show up in server logs the way
// resend-sender.ts's own error is designed to (see its doc comment).
async function sendNotificationEmail(params: Parameters<typeof sendBrandedEmail>[0]): Promise<void> {
  try {
    await sendBrandedEmail(params);
  } catch (err) {
    console.error("Failed to send notification email:", err);
  }
}

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

  // why fetched before deleting, not after: once auth.admin.deleteUser
  // succeeds there's no record of the target's email left to notify.
  const { data: targetAuthUser } = await service.auth.admin.getUserById(targetUserId);
  const targetEmail = targetAuthUser.user?.email ?? null;

  // auth.admin.deleteUser cascades to profiles (on delete cascade), which
  // cascades to quiz_attempts/quiz_questions/plant_stats/personal
  // quiz_themes via their own FKs.
  const { error } = await service.auth.admin.deleteUser(targetUserId);
  if (error) throw error;

  if (targetEmail) {
    await sendNotificationEmail({
      to: targetEmail,
      subject: "Your Specify account has been removed",
      heading: "Account removed",
      bodyHtml: `<p>Your Specify account and all associated quiz data has been permanently deleted by an administrator.</p>
        <p>If you believe this was a mistake, get in touch with whoever manages your Specify access.</p>`,
    });
  }
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteUserResult = { alreadyInvited: boolean; unlockedExistingAccount: boolean };

// why this also unlocks an existing account, not just inserts the
// allow-list row: allowed_emails is only ever consulted by handle_new_user
// at the moment an auth.users row is first created (SPEC-004's signup
// trigger) — inviting someone *after* they've already tried (and failed) to
// sign in leaves their existing profiles.is_allowed stuck at false forever,
// since nothing re-checks the allow-list for a row that already exists.
// Jamie hit exactly this on 2026-08-30 and needed a direct database fix;
// this generalizes that fix into the invite action itself.
export async function inviteUserCore(
  actingClient: SupabaseClient,
  actingUserId: string,
  rawEmail: string,
): Promise<InviteUserResult> {
  await requireActingAdmin(actingClient, actingUserId);

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address.");

  const service = createServiceRoleClient();

  const { data: existingInvite } = await service
    .from("allowed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  const alreadyInvited = existingInvite !== null;

  if (!alreadyInvited) {
    const { error } = await service.from("allowed_emails").insert({ email, added_by: actingUserId });
    if (error) throw error;
  }

  // why listUsers + find, not a direct lookup: the admin API has no
  // "get user by email" — this app's user count is small enough (invite-only)
  // that paging through everyone is fine, same pattern as
  // rls-test-helpers.ts's getPrimaryAdminUserId.
  const { data: usersPage, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existingAuthUser = usersPage.users.find((u) => u.email?.toLowerCase() === email);

  let unlockedExistingAccount = false;
  if (existingAuthUser) {
    const { data: profile } = await service
      .from("profiles")
      .select("is_allowed")
      .eq("id", existingAuthUser.id)
      .single();
    if (profile && !profile.is_allowed) {
      const { error } = await service.from("profiles").update({ is_allowed: true }).eq("id", existingAuthUser.id);
      if (error) throw error;
      unlockedExistingAccount = true;
    }
  }

  // why only when something actually changed: an admin re-inviting an
  // already-invited, already-unlocked email would otherwise get a
  // duplicate email every time the form is submitted again.
  if (!alreadyInvited || unlockedExistingAccount) {
    await sendNotificationEmail({
      to: email,
      subject: "You're invited to Specify",
      heading: "You're invited to Specify",
      bodyHtml: `<p>You can now sign in to Specify with your Google account (${escapeHtml(email)}).</p>
        <p>Specify helps garden designers learn plant scientific names and characteristics through quizzes.</p>
        <p><a href="${SIGN_IN_URL}" style="display:inline-block;background:#4c6429;color:#faf9f0;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to Specify</a></p>`,
    });
  }

  return { alreadyInvited, unlockedExistingAccount };
}

export async function inviteUser(email: string): Promise<InviteUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const result = await inviteUserCore(supabase, user.id, email);
  revalidatePath("/admin");
  return result;
}
