import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./rls-test-helpers";

const createdUsers: TestUser[] = [];
// why tracked separately from createdUsers: a *global* quiz_themes row has
// owner_id = null, so it is never cascade-deleted when a test user is
// removed — unlike every other table these tests touch. Missing this was a
// real bug: 14 stray "Curated Trees (updated)" global themes leaked into
// the live app's real /quizzes page (one per full test-suite run since this
// test was written) before it was caught via manual QA, not by the tests
// themselves.
const createdGlobalThemeIds: string[] = [];
let testPlantId: string;

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

beforeAll(async () => {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("plants")
    .insert({
      scientific_name: `Testus plantus SPEC-007 ${Date.now()}`,
      source: "rhs",
      source_url: `https://example.com/spec-007-${Date.now()}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  testPlantId = data.id;
});

afterAll(async () => {
  // why this order: quiz_questions.plant_id has no ON DELETE CASCADE (a
  // plant shouldn't vanish just because a delete happens to cascade through
  // it) — deleting the shared test plant *before* the test users left their
  // quiz_questions rows still referencing it, which silently failed the
  // delete (caught by a blanket try/catch) and leaked stray rows into the
  // real plants table on every run. Users (and their quiz_questions, via
  // quiz_attempts' cascade) must go first.
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});

  const admin = createServiceRoleClient();
  for (const themeId of createdGlobalThemeIds) {
    try {
      await admin.from("quiz_themes").delete().eq("id", themeId);
    } catch {
      // best-effort cleanup
    }
  }
  try {
    await admin.from("plants").delete().eq("id", testPlantId);
  } catch {
    // best-effort cleanup
  }
});

describe("quiz_themes RLS", () => {
  it("shows the Lucky Dip global theme to any authenticated user", async () => {
    const user = await newTestUser("luckydip-visibility");
    const { data, error } = await user.client
      .from("quiz_themes")
      .select("display_name, is_global, is_lucky_dip")
      .eq("is_lucky_dip", true)
      .single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe("Lucky Dip");
  });

  it("lets a user create and see their own personal theme, invisible to others", async () => {
    const owner = await newTestUser("theme-owner");
    const other = await newTestUser("theme-other");

    const { data: created, error: createError } = await owner.client
      .from("quiz_themes")
      .insert({ display_name: "My Trees", prompt: "trees", owner_id: owner.userId, is_global: false })
      .select("id")
      .single();
    expect(createError).toBeNull();

    const { data: ownRead } = await owner.client
      .from("quiz_themes")
      .select("id")
      .eq("id", created!.id);
    expect(ownRead).toHaveLength(1);

    const { data: otherRead } = await other.client
      .from("quiz_themes")
      .select("id")
      .eq("id", created!.id);
    expect(otherRead).toEqual([]);
  });

  it("blocks a non-admin from creating or editing a global theme", async () => {
    const user = await newTestUser("nonadmin-global");
    const { error: createError } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Sneaky Global", prompt: "", owner_id: null, is_global: true });
    expect(createError).not.toBeNull();

    const { data: luckyDip } = await user.client
      .from("quiz_themes")
      .select("id")
      .eq("is_lucky_dip", true)
      .single();
    // why .select() + asserting an empty array, not an error: Postgres RLS
    // makes an UPDATE whose USING clause excludes the row simply match zero
    // rows — it does not raise. The only way to actually observe "nothing
    // was changed" is to ask PostgREST to return the affected rows.
    const { data: updated, error: updateError } = await user.client
      .from("quiz_themes")
      .update({ display_name: "Hijacked" })
      .eq("id", luckyDip!.id)
      .select("id");
    expect(updateError).toBeNull();
    expect(updated).toEqual([]);

    const { data: unchanged } = await createServiceRoleClient()
      .from("quiz_themes")
      .select("display_name")
      .eq("id", luckyDip!.id)
      .single();
    expect(unchanged?.display_name).toBe("Lucky Dip");
  });

  it("lets an admin create and edit a global theme", async () => {
    const admin = await newTestUser("admin-global");
    await promoteToAdmin(admin.userId);

    const { data: created, error: createError } = await admin.client
      .from("quiz_themes")
      .insert({ display_name: "Curated Trees", prompt: "trees", owner_id: null, is_global: true })
      .select("id")
      .single();
    expect(createError).toBeNull();
    createdGlobalThemeIds.push(created!.id);

    const { error: updateError } = await admin.client
      .from("quiz_themes")
      .update({ display_name: "Curated Trees (updated)" })
      .eq("id", created!.id);
    expect(updateError).toBeNull();
  });

  it("never allows deleting the Lucky Dip theme, even via service-role", async () => {
    const serviceRole = createServiceRoleClient();
    const { data: luckyDip } = await serviceRole
      .from("quiz_themes")
      .select("id")
      .eq("is_lucky_dip", true)
      .single();
    const { error } = await serviceRole.from("quiz_themes").delete().eq("id", luckyDip!.id);
    expect(error).not.toBeNull();
  });
});

describe("quiz_attempts / quiz_questions / plant_stats RLS", () => {
  it("lets a user create an attempt + question and read them back", async () => {
    const user = await newTestUser("attempt-owner");
    const { data: luckyDip } = await user.client
      .from("quiz_themes")
      .select("id")
      .eq("is_lucky_dip", true)
      .single();

    const { data: attempt, error: attemptError } = await user.client
      .from("quiz_attempts")
      .insert({
        user_id: user.userId,
        theme_id: luckyDip!.id,
        mode: "intermediate",
        question_count: 1,
        geo_scope: "UK",
      })
      .select("id")
      .single();
    expect(attemptError).toBeNull();

    const { error: questionError } = await user.client.from("quiz_questions").insert({
      attempt_id: attempt!.id,
      plant_id: testPlantId,
      question_type: "name",
      sequence: 1,
    });
    expect(questionError).toBeNull();

    const { error: statsError } = await user.client
      .from("plant_stats")
      .upsert({ user_id: user.userId, plant_id: testPlantId, times_seen: 1 });
    expect(statsError).toBeNull();
  });

  it("cannot read another user's quiz_attempts, quiz_questions, or plant_stats", async () => {
    const owner = await newTestUser("data-owner");
    const stranger = await newTestUser("data-stranger");
    const { data: luckyDip } = await owner.client
      .from("quiz_themes")
      .select("id")
      .eq("is_lucky_dip", true)
      .single();

    const { data: attempt } = await owner.client
      .from("quiz_attempts")
      .insert({
        user_id: owner.userId,
        theme_id: luckyDip!.id,
        mode: "hard",
        question_count: 1,
        geo_scope: "Global",
      })
      .select("id")
      .single();
    await owner.client.from("quiz_questions").insert({
      attempt_id: attempt!.id,
      plant_id: testPlantId,
      question_type: "name",
      sequence: 1,
    });
    await owner.client
      .from("plant_stats")
      .upsert({ user_id: owner.userId, plant_id: testPlantId, times_seen: 1 });

    const { data: strangerAttempts } = await stranger.client
      .from("quiz_attempts")
      .select("id")
      .eq("id", attempt!.id);
    expect(strangerAttempts).toEqual([]);

    const { data: strangerQuestions } = await stranger.client
      .from("quiz_questions")
      .select("id")
      .eq("attempt_id", attempt!.id);
    expect(strangerQuestions).toEqual([]);

    const { data: strangerStats } = await stranger.client
      .from("plant_stats")
      .select("*")
      .eq("user_id", owner.userId);
    expect(strangerStats).toEqual([]);
  });

  it("CRITICAL: an admin cannot read another user's quiz data either — the admin role is identity-management only", async () => {
    const owner = await newTestUser("protected-owner");
    const admin = await newTestUser("nosy-admin");
    await promoteToAdmin(admin.userId);

    const { data: luckyDip } = await owner.client
      .from("quiz_themes")
      .select("id")
      .eq("is_lucky_dip", true)
      .single();
    const { data: attempt } = await owner.client
      .from("quiz_attempts")
      .insert({
        user_id: owner.userId,
        theme_id: luckyDip!.id,
        mode: "learning",
        question_count: 1,
        geo_scope: "UK",
      })
      .select("id")
      .single();
    await owner.client
      .from("plant_stats")
      .upsert({ user_id: owner.userId, plant_id: testPlantId, times_seen: 3, times_correct: 2 });

    const { data: adminAttempts } = await admin.client
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", owner.userId);
    expect(adminAttempts).toEqual([]);

    const { data: adminQuestions } = await admin.client
      .from("quiz_questions")
      .select("id")
      .eq("attempt_id", attempt!.id);
    expect(adminQuestions).toEqual([]);

    const { data: adminStats } = await admin.client
      .from("plant_stats")
      .select("*")
      .eq("user_id", owner.userId);
    expect(adminStats).toEqual([]);
  });
});
