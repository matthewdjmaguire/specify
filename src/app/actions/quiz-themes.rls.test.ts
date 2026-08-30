import { afterAll, describe, expect, it } from "vitest";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "@/test/rls-test-helpers";
import { startQuizAttemptCore } from "./quiz-attempts";

const createdUsers: TestUser[] = [];
// why tracked separately, not just deleted via cascade from the test users:
// these are global (owner_id = null) quiz_themes rows — the per-user test
// cleanup cascade doesn't reach them (see CLAUDE.md's Learnings on shared/
// global-table test leakage).
const createdGlobalThemeIds: string[] = [];
// why attempts are tracked and deleted separately, before the themes: the
// "blocked" test below deliberately leaves a real quiz_attempts row
// referencing its theme (that's the whole point — proving the delete is
// blocked). quiz_themes.theme_id is ON DELETE RESTRICT (2026-08-30 security
// fix), so deleting the theme in afterAll while that attempt still exists
// would fail with the exact same 23503 the test asserts — and supabase-js
// doesn't throw on that, it returns `{ error }`, so a swallowed
// `try { await query } catch {}` around the theme delete would silently
// leak the theme on every run. Eight copies of this exact leak had already
// accumulated by the time this comment was written.
const createdAttemptIds: string[] = [];

async function newTestUser(label: string): Promise<TestUser> {
  const user = await createTestUser(label);
  createdUsers.push(user);
  return user;
}

async function promoteToAdmin(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
  if (error) throw error;
}

afterAll(async () => {
  const admin = createServiceRoleClient();
  if (createdAttemptIds.length > 0) {
    const { error } = await admin.from("quiz_attempts").delete().in("id", createdAttemptIds);
    if (error) console.error("Failed to clean up test quiz_attempts:", error);
  }
  if (createdGlobalThemeIds.length > 0) {
    const { error } = await admin.from("quiz_themes").delete().in("id", createdGlobalThemeIds);
    if (error) console.error("Failed to clean up test quiz_themes:", error);
  }
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
});

// why this exercises the raw quiz_themes delete query directly, not
// deleteQuizTheme(): that "use server" wrapper reads cookies via
// next/headers, which only works inside a real Next.js request (see
// quiz-attempts.rls.test.ts's own comment on this pattern) — this test
// issues the exact same `.from("quiz_themes").delete().eq("id", id)` query
// the wrapper performs, against a real authenticated admin session, so it
// exercises the same RLS policy + FK constraint the app relies on.
describe("deleting a global quiz theme (against the live schema)", () => {
  it("is blocked once a quiz_attempts row references it, leaving the attempt intact", async () => {
    const admin = await newTestUser("theme-delete-blocked-admin");
    await promoteToAdmin(admin.userId);

    const { data: theme, error: themeError } = await admin.client
      .from("quiz_themes")
      .insert({ display_name: "SPEC security-review test theme", prompt: "acer", owner_id: null, is_global: true })
      .select("id")
      .single();
    if (themeError) throw themeError;
    createdGlobalThemeIds.push(theme.id);

    const attemptId = await startQuizAttemptCore(admin.client, admin.userId, {
      themeId: theme.id,
      mode: "learning",
      geoScope: "Global",
      questionCount: 1,
    });
    createdAttemptIds.push(attemptId);

    const { error: deleteError } = await admin.client.from("quiz_themes").delete().eq("id", theme.id);
    expect(deleteError).not.toBeNull();
    expect(deleteError?.code).toBe("23503");

    const { data: attemptStillExists } = await admin.client
      .from("quiz_attempts")
      .select("id")
      .eq("id", attemptId)
      .maybeSingle();
    expect(attemptStillExists).not.toBeNull();
  });

  it("still succeeds for a theme with no attempts against it", async () => {
    const admin = await newTestUser("theme-delete-clean-admin");
    await promoteToAdmin(admin.userId);

    const { data: theme, error: themeError } = await admin.client
      .from("quiz_themes")
      .insert({ display_name: "SPEC security-review clean theme", prompt: "acer", owner_id: null, is_global: true })
      .select("id")
      .single();
    if (themeError) throw themeError;

    const { error: deleteError } = await admin.client.from("quiz_themes").delete().eq("id", theme.id);
    expect(deleteError).toBeNull();

    const { data: gone } = await admin.client.from("quiz_themes").select("id").eq("id", theme.id).maybeSingle();
    expect(gone).toBeNull();
  });
});
