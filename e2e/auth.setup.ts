import { test as setup } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { USER_AUTH_FILE, ADMIN_AUTH_FILE, USER_CONTEXT_FILE } from "./auth-files";

// why the same @spec004-test.invalid suffix the vitest RLS suite uses:
// that suite's cleanupAllTestUsers() sweep (rls-test-helpers.ts) then
// also catches any e2e user left behind by an interrupted run, on top of
// this suite's own teardown project — belt and suspenders, same reasoning
// as SPEC-021's Learnings entry about stray test users.
const TEST_EMAIL_SUFFIX = "@spec004-test.invalid";
const TEST_PASSWORD = "e2e-test-password-!23";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function serviceRoleClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// why rebuild the cookies via @supabase/ssr's own createServerClient
// rather than hand-crafting the sb-*-auth-token cookie format: that format
// (base64- prefix, chunked across .0/.1 cookies past a size threshold) is
// an implementation detail of the installed @supabase/ssr version — asking
// the real library to produce it via setSession() stays correct across
// version bumps instead of hardcoding today's encoding.
async function buildStorageState(email: string, password: string) {
  const anon = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signedIn, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signedIn.session) throw new Error(`e2e sign-in failed: ${error?.message}`);

  const collected: Array<{ name: string; value: string; options: CookieOptionsWithName }> = [];
  const serverClient = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        collected.push(...cookies);
      },
    },
  });
  await serverClient.auth.setSession({
    access_token: signedIn.session.access_token,
    refresh_token: signedIn.session.refresh_token,
  });

  return {
    cookies: collected.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
      expires: -1,
    })),
    origins: [],
  };
}

async function createSignedInTestUser(label: string, { isAdmin }: { isAdmin: boolean }) {
  const admin = serviceRoleClient();
  const email = `${label}-${Date.now()}${TEST_EMAIL_SUFFIX}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Failed to create e2e test user: ${createError?.message}`);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_allowed: true, is_admin: isAdmin })
    .eq("id", created.user.id);
  if (updateError) throw new Error(`Failed to allow-list e2e test user: ${updateError.message}`);

  const state = await buildStorageState(email, TEST_PASSWORD);
  return { userId: created.user.id, state };
}

// why a personal theme scoped to one plant's species epithet, not Lucky
// Dip: Lucky Dip matches the whole catalogue (260+ plants), and quiz
// length can't go below 20 via settings — clicking through a 3-mode
// golden path against that many questions would make this suite far too
// slow to be worth running. A prompt built from a real plant's own
// scientific name keyword reliably narrows the pool to a handful.
async function createSmallPersonalTheme(userId: string): Promise<string> {
  const admin = serviceRoleClient();
  const { data: plant, error: plantError } = await admin
    .from("plants")
    .select("scientific_name")
    .limit(1)
    .single();
  if (plantError || !plant) throw new Error(`Failed to find a seed plant for the e2e theme: ${plantError?.message}`);

  const words = plant.scientific_name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const epithet = words.find((w: string, i: number) => i > 0 && w.length >= 3) ?? words[0];

  const { data: theme, error: themeError } = await admin
    .from("quiz_themes")
    .insert({ display_name: "E2E Small Theme", prompt: epithet, owner_id: userId, is_global: false })
    .select("id")
    .single();
  if (themeError || !theme) throw new Error(`Failed to create e2e theme: ${themeError?.message}`);

  return theme.id;
}

setup("authenticate as a regular allow-listed user", async () => {
  const { userId, state } = await createSignedInTestUser("e2e-user", { isAdmin: false });
  const smallThemeId = await createSmallPersonalTheme(userId);

  mkdirSync(path.dirname(USER_AUTH_FILE), { recursive: true });
  writeFileSync(USER_AUTH_FILE, JSON.stringify(state, null, 2));
  writeFileSync(USER_CONTEXT_FILE, JSON.stringify({ smallThemeId }, null, 2));
});

setup("authenticate as an admin", async () => {
  const { state } = await createSignedInTestUser("e2e-admin", { isAdmin: true });
  mkdirSync(path.dirname(ADMIN_AUTH_FILE), { recursive: true });
  writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(state, null, 2));
});
