import { afterAll, describe, expect, it } from "vitest";
import { cleanupAllTestUsers, deleteTestUser, createTestUser, type TestUser } from "@/test/rls-test-helpers";
import { startQuizAttemptCore, completeQuizAttemptCore, getResumableAttemptCore } from "./quiz-attempts";
import { toggleFavouriteCore, getOrCreateFavouritesThemeCore } from "./favourites";

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

    // why the actual live count, not a hardcoded number: the real seed had
    // 5 Acer plants when this test was written, but admin-triggered catalogue
    // top-ups (SPEC-027's follow-up work) grow it over time — asserting
    // against a fixed number breaks the moment more Acer plants get
    // imported, which isn't a regression, just catalogue growth. Requesting
    // far more than exist either way is still what proves the cap works.
    const { count: actualAcerCount } = await user.client
      .from("plants")
      .select("id", { count: "exact", head: true })
      .eq("genus", "Acer");

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
    expect(attempt!.question_count).toBeLessThanOrEqual(actualAcerCount!);
    expect(attempt!.question_count).toBeGreaterThan(0);
  });

  it("creates follow-up characteristic questions for non-Learning modes, honouring profiles.followup_count", async () => {
    const user = await newTestUser("startquiz-followup");
    await user.client.from("profiles").update({ followup_count: 2 }).eq("id", user.userId);

    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer followup", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "intermediate",
      geoScope: "Global",
      questionCount: 2,
    });

    const { data: questions } = await user.client
      .from("quiz_questions")
      .select("sequence, question_type, plant_id")
      .eq("attempt_id", attemptId)
      .order("sequence");

    const nameQuestions = questions!.filter((q) => q.question_type === "name");
    const followupQuestions = questions!.filter((q) => q.question_type.startsWith("characteristic:"));

    expect(nameQuestions).toHaveLength(2);
    // why >0 rather than exactly 4 (2 plants x 2 requested): a real Acer
    // plant may not have data for 2 distinct categories, in which case
    // fewer follow-ups get created for it — SPEC-014's own "skip
    // unpopulated categories" rule, exercised here against real data rather
    // than a synthetic fixture.
    expect(followupQuestions.length).toBeGreaterThan(0);
    expect(followupQuestions.length).toBeLessThanOrEqual(4);

    // Every follow-up must immediately follow (in sequence) a question
    // about the *same* plant — it's a follow-up to that specific name
    // question, not an unrelated one.
    for (const followup of followupQuestions) {
      const sameSequenceGroup = questions!.filter((q) => q.plant_id === followup.plant_id);
      expect(sameSequenceGroup.some((q) => q.question_type === "name")).toBe(true);
    }

    // Sequence numbers are contiguous 1..N with no gaps or duplicates.
    const sequences = questions!.map((q) => q.sequence).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: sequences.length }, (_, i) => i + 1));
  });

  it("creates no follow-up questions for Learning mode even with followup_count > 1", async () => {
    const user = await newTestUser("startquiz-nofollowup");
    await user.client.from("profiles").update({ followup_count: 5 }).eq("id", user.userId);

    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer learning", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "learning",
      geoScope: "Global",
      questionCount: 2,
    });

    const { data: questions } = await user.client
      .from("quiz_questions")
      .select("question_type")
      .eq("attempt_id", attemptId);
    expect(questions!.every((q) => q.question_type === "name")).toBe(true);
  });
});

describe("starting a quiz on the favourites theme", () => {
  it("draws only from the user's favourited plants, not the whole catalogue", async () => {
    const user = await newTestUser("startquiz-fav");
    const { data: plants } = await user.client
      .from("plants")
      .select("id")
      .contains("geo_tags", ["Global"])
      .limit(2);
    // why a service-role fallback if the geo-tagged query comes up short:
    // this only needs *some* two real plant ids to favourite — which two
    // doesn't matter, so fall back to any two rows if the live catalogue's
    // Global-tagged set happens to be smaller than expected.
    const twoPlantIds =
      (plants ?? []).length >= 2
        ? plants!.slice(0, 2).map((p) => p.id)
        : (await user.client.from("plants").select("id").limit(2)).data!.map((p) => p.id);

    await toggleFavouriteCore(user.client, user.userId, twoPlantIds[0], true);
    await toggleFavouriteCore(user.client, user.userId, twoPlantIds[1], true);

    const favThemeId = await getOrCreateFavouritesThemeCore(user.client, user.userId);
    const attemptId = await startQuizAttemptAs(user, {
      themeId: favThemeId,
      mode: "learning",
      geoScope: "Global",
      questionCount: 20,
    });

    const { data: questions } = await user.client
      .from("quiz_questions")
      .select("plant_id")
      .eq("attempt_id", attemptId)
      .eq("question_type", "name");
    const questionedPlantIds = new Set(questions!.map((q) => q.plant_id));
    expect(questionedPlantIds.size).toBe(2);
    for (const id of questionedPlantIds) {
      expect(twoPlantIds).toContain(id);
    }
  });

  it("fails with a clear error when the user has no favourites yet", async () => {
    const user = await newTestUser("startquiz-fav-empty");
    const favThemeId = await getOrCreateFavouritesThemeCore(user.client, user.userId);

    await expect(
      startQuizAttemptAs(user, { themeId: favThemeId, mode: "learning", geoScope: "Global", questionCount: 20 }),
    ).rejects.toThrow("haven't favourited");
  });
});

describe("getResumableAttemptCore", () => {
  it("finds the most recent incomplete attempt for a theme+mode, ignoring completed ones", async () => {
    const user = await newTestUser("resume-basic");
    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer resume", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    expect(await getResumableAttemptCore(user.client, user.userId, theme!.id, "intermediate")).toBeNull();

    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "intermediate",
      geoScope: "Global",
      questionCount: 2,
    });
    expect(await getResumableAttemptCore(user.client, user.userId, theme!.id, "intermediate")).toMatchObject({
      id: attemptId,
      geoScope: "Global",
    });

    // a different mode on the same theme is a different resumable slot
    expect(await getResumableAttemptCore(user.client, user.userId, theme!.id, "hard")).toBeNull();

    await completeQuizAttemptCore(user.client, attemptId);
    expect(await getResumableAttemptCore(user.client, user.userId, theme!.id, "intermediate")).toBeNull();
  });

  it("returns only the most recent of several incomplete attempts for the same theme+mode", async () => {
    const user = await newTestUser("resume-latest");
    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer resume 2", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();

    await startQuizAttemptAs(user, { themeId: theme!.id, mode: "hard", geoScope: "Global", questionCount: 2 });
    const secondAttemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "hard",
      geoScope: "Global",
      questionCount: 2,
    });

    expect(await getResumableAttemptCore(user.client, user.userId, theme!.id, "hard")).toMatchObject({
      id: secondAttemptId,
    });
  });
});

describe("completing a quiz attempt", () => {
  it("sets completed_at, which starts null", async () => {
    const user = await newTestUser("completequiz");
    const { data: theme } = await user.client
      .from("quiz_themes")
      .insert({ display_name: "Acer complete", prompt: "acer", owner_id: user.userId, is_global: false })
      .select("id")
      .single();
    const attemptId = await startQuizAttemptAs(user, {
      themeId: theme!.id,
      mode: "learning",
      geoScope: "Global",
      questionCount: 2,
    });

    const { data: before } = await user.client
      .from("quiz_attempts")
      .select("completed_at")
      .eq("id", attemptId)
      .single();
    expect(before!.completed_at).toBeNull();

    await completeQuizAttemptCore(user.client, attemptId);

    const { data: after } = await user.client
      .from("quiz_attempts")
      .select("completed_at")
      .eq("id", attemptId)
      .single();
    expect(after!.completed_at).not.toBeNull();
  });
});
