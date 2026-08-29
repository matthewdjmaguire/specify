import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "@/test/rls-test-helpers";
import { recordPlantMasteryCore } from "./plant-stats";

const createdUsers: TestUser[] = [];
let testPlantId: string;

beforeAll(async () => {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("plants")
    .insert({
      scientific_name: `Testus masteryus SPEC-017 ${Date.now()}`,
      source: "rhs",
      source_url: `https://example.com/spec-017-${Date.now()}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  testPlantId = data.id;
});

afterAll(async () => {
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
  // why plants deleted last: same FK-ordering lesson SPEC-007's tests hit —
  // deleting a plant while a user's plant_stats row still references it
  // would fail silently under a blanket try/catch otherwise.
  try {
    await createServiceRoleClient().from("plants").delete().eq("id", testPlantId);
  } catch {
    // best-effort cleanup
  }
});

describe("recordPlantMasteryCore (against the live schema)", () => {
  it("creates a plant_stats row on first encounter", async () => {
    const user = await createTestUser("mastery-first");
    createdUsers.push(user);

    await recordPlantMasteryCore(user.client, user.userId, testPlantId, true);

    const { data } = await user.client
      .from("plant_stats")
      .select("times_seen, times_correct, times_incorrect, priority_weight, last_seen_at")
      .eq("user_id", user.userId)
      .eq("plant_id", testPlantId)
      .single();

    expect(data).toMatchObject({ times_seen: 1, times_correct: 1, times_incorrect: 0 });
    expect(data!.priority_weight).toBeCloseTo(0.6);
    expect(data!.last_seen_at).not.toBeNull();
  });

  it("accumulates seen/correct/incorrect counts across repeated answers, not just the latest one", async () => {
    const user = await createTestUser("mastery-accumulate");
    createdUsers.push(user);

    await recordPlantMasteryCore(user.client, user.userId, testPlantId, false);
    await recordPlantMasteryCore(user.client, user.userId, testPlantId, false);
    await recordPlantMasteryCore(user.client, user.userId, testPlantId, true);

    const { data } = await user.client
      .from("plant_stats")
      .select("times_seen, times_correct, times_incorrect, priority_weight")
      .eq("user_id", user.userId)
      .eq("plant_id", testPlantId)
      .single();

    expect(data).toMatchObject({ times_seen: 3, times_correct: 1, times_incorrect: 2 });
    // weight: 1 -> (wrong) 2 -> (wrong) 4 -> (correct) 2.4
    expect(data!.priority_weight).toBeCloseTo(2.4);
  });

  it("is scoped per-user — two users quizzing the same plant get independent stats", async () => {
    const userA = await createTestUser("mastery-usera");
    const userB = await createTestUser("mastery-userb");
    createdUsers.push(userA, userB);

    await recordPlantMasteryCore(userA.client, userA.userId, testPlantId, false);
    await recordPlantMasteryCore(userB.client, userB.userId, testPlantId, true);

    const { data: statsA } = await userA.client
      .from("plant_stats")
      .select("times_incorrect")
      .eq("user_id", userA.userId)
      .eq("plant_id", testPlantId)
      .single();
    const { data: statsB } = await userB.client
      .from("plant_stats")
      .select("times_correct")
      .eq("user_id", userB.userId)
      .eq("plant_id", testPlantId)
      .single();

    expect(statsA!.times_incorrect).toBe(1);
    expect(statsB!.times_correct).toBe(1);
  });
});
