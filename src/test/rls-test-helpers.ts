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
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError || !signedIn.session) {
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
