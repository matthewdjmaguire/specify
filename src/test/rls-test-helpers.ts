import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// why: separate Supabase clients in the same process can clobber each
// other's session if they share a storage key — disable persistence entirely
// for test-only clients (BC2 hit this exact bug: "separate Supabase clients
// share one localStorage-backed session key" under jsdom; disabling persistence
// avoids it regardless of environment).
const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), NO_PERSIST);
}

export function createAnonClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), NO_PERSIST);
}

const TEST_EMAIL_SUFFIX = "@spec004-test.invalid";
const TEST_PASSWORD = "spec004-test-password-!23";

export type TestUser = {
  userId: string;
  email: string;
  client: SupabaseClient;
};

// why: creating a real, pre-confirmed user via the admin API (service-role)
// and signing in with a password gives a genuine authenticated session/JWT to
// test RLS policies against — the only way to actually exercise `auth.uid()`
// and `auth.role()` as Postgres itself evaluates them, rather than guessing.
function isRateLimitError(error: { status?: number; message?: string } | null): boolean {
  return error?.status === 429 || (error?.message?.toLowerCase().includes("rate limit") ?? false);
}

// why retry with backoff: signInWithPassword hits Supabase Auth's public,
// per-IP sign-in rate limit (unlike admin.createUser above, which goes
// through the service-role admin API and isn't subject to it) — CI runs
// dozens of these within seconds from GitHub Actions' shared runner IP pool
// and reliably tripped it (2026-08-30, four CI runs in a row on the same
// push). Spreading retries out over a few seconds lets the suite finish
// inside the rate limit window instead of failing outright.
async function signInWithRetry(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<{ session: { access_token: string } | null; error: { status?: number; message?: string } | null }> {
  const delaysMs = [1000, 2000, 4000, 8000];
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error || !isRateLimitError(error) || attempt >= delaysMs.length) {
      return { session: data.session, error };
    }
    await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
  }
}

export async function createTestUser(label: string): Promise<TestUser> {
  const admin = createServiceRoleClient();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${TEST_EMAIL_SUFFIX}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }

  const client = createAnonClient();
  const { session, error: signInError } = await signInWithRetry(client, email, TEST_PASSWORD);
  if (signInError || !session) {
    throw new Error(`Failed to sign in test user: ${signInError?.message}`);
  }

  return { userId: created.user.id, email, client };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  // The primary-admin guard trigger only blocks deleting a primary-admin row;
  // ordinary test users delete cleanly.
  await admin.auth.admin.deleteUser(userId);
}

export async function cleanupAllTestUsers(): Promise<void> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const stale = data.users.filter((u) => u.email?.endsWith(TEST_EMAIL_SUFFIX));
  for (const user of stale) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

// why: profiles_guard_delete blocks deleting any is_primary_admin row
// unconditionally, even for service-role — by design, so the real primary
// admin can never be removed. That means a test must never promote a
// disposable test user to is_primary_admin: once set, nothing can ever
// delete that row again (23 such rows leaked into the live database this
// way before this helper existed — see CLAUDE.md's Learnings). Use this to
// test primary-admin guard behaviour against the one real seeded row
// instead — every assertion these guards exist for expects the operation to
// fail and leave the row unchanged, so exercising them against the real row
// is safe.
export async function getPrimaryAdminUserId(): Promise<string> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const primaryAdmin = data.users.find((u) => u.email === "matthewdjmaguire@gmail.com");
  if (!primaryAdmin) {
    throw new Error(
      "Seeded primary admin (matthewdjmaguire@gmail.com) not found — is this pointed at the right database?",
    );
  }
  return primaryAdmin.id;
}
