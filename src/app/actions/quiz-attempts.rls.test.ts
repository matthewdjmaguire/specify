import { afterAll, describe, expect, it } from "vitest";
import { cleanupAllTestUsers, deleteTestUser, createTestUser, type TestUser } from "@/test/rls-test-helpers";
import { startQuizAttemptCore } from "./quiz-attempts";

const createdUsers: TestUser[] = [];

async function newTestUser(label: string): Promise<TestUser> {
  const user = await createTestUser(label);
  createdUsers.push(user);
  return user;
}

afterAll(async () => {
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
});

// why startQuizAttemptCore, not startQuizAttempt: the exported server action
// reads cookies via next/headers, which only works inside a real Next.js
// request. startQuizAttemptCore takes a plain SupabaseClient + userId, so
// this test runs the *exact same logic* the server action calls, just
// without the cookie plumbing — see quiz-attempts.ts's own comment on why
// it's split this way.
async function startQuizAttemptAs(user: TestUser, input: Parameters<typeof startQuizAttemptCore>[2]) {
  return startQuizAttemptCore(user.client, user.userId, input);
}

describe("starting a quiz attempt (against the live schema)", () => {
  it("creates an attempt and the right number of correctly-sequenced, unanswered questions", async () => {
    const user = await newTestUser("startquiz-acer");
    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer test", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "learning",
      geoScope: "Global",
      questionCount: 3,
    });

    const { data: attempt } = await user.client
      .from("quiz_attempts")
      .select("question_count, geo_scope, mode")
      .eq("id", attemptId)
      .single();
    expect(attempt).toMatchObject({ question_count: 3, geo_scope: "Global", mode: "learning" });

    const { data: questions } = await user.client
      .from("quiz_questions")
      .select("sequence, status, plants(genus)")
      .eq("attempt_id", attemptId)
      .order("sequence");
    expect(questions).toHaveLength(3);
    expect(questions!.map((q) => q.sequence)).toEqual([1, 2, 3]);
    expect(questions!.every((q) => q.status === "unanswered")).toBe(true);
    expect(questions!.every((q: { plants: unknown }) => (q.plants as { genus: string }).genus === "Acer")).toBe(
      true,
    );
  });

  it("caps question_count at however many plants actually match a narrow scope", async () => {
    const user = await newTestUser("startquiz-narrow");
    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer narrow", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    // The real seed has 5 Acer plants (see SPEC-001's Learnings) — request
    // far more than that and confirm it doesn't silently over-report.
    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "intermediate",
      geoScope: "Global",
      questionCount: 100,
    });

    const { data: attempt } = await user.client
      .from("quiz_attempts")
      .select("question_count")
      .eq("id", attemptId)
      .single();
    expect(attempt!.question_count).toBeLessThanOrEqual(5);
    expect(attempt!.question_count).toBeGreaterThan(0);
  });
});
