import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "@/test/rls-test-helpers";
import { getFavouritePlantIdsCore, getFavouritedPlantsCore, toggleFavouriteCore } from "./favourites";
import { recordPlantMasteryCore } from "./plant-stats";

const createdUsers: TestUser[] = [];
let plantA: string;
let plantB: string;

beforeAll(async () => {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("plants")
    .insert([
      { scientific_name: `Zea favouritus SPEC-FAV ${Date.now()}`, source: "rhs", source_url: `https://example.com/fav-a-${Date.now()}` },
      { scientific_name: `Abies favouritus SPEC-FAV ${Date.now()}`, source: "rhs", source_url: `https://example.com/fav-b-${Date.now()}` },
    ])
    .select("id, scientific_name");
  if (error) throw error;
  plantA = data!.find((p) => p.scientific_name.startsWith("Zea"))!.id;
  plantB = data!.find((p) => p.scientific_name.startsWith("Abies"))!.id;
});

afterAll(async () => {
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
  try {
    await createServiceRoleClient().from("plants").delete().in("id", [plantA, plantB]);
  } catch {
    // best-effort cleanup
  }
});

describe("toggleFavouriteCore (against the live schema)", () => {
  it("creates a plant_stats row when none existed, with default stats intact", async () => {
    const user = await createTestUser("fav-first");
    createdUsers.push(user);

    await toggleFavouriteCore(user.client, user.userId, plantA, true);

    const { data } = await user.client
      .from("plant_stats")
      .select("is_favourite, times_seen, priority_weight")
      .eq("user_id", user.userId)
      .eq("plant_id", plantA)
      .single();
    expect(data).toMatchObject({ is_favourite: true, times_seen: 0, priority_weight: 1 });
  });

  it("toggling a favourite doesn't clobber existing mastery stats on the same row", async () => {
    const user = await createTestUser("fav-preserve");
    createdUsers.push(user);

    await recordPlantMasteryCore(user.client, user.userId, plantA, true);
    await toggleFavouriteCore(user.client, user.userId, plantA, true);

    const { data } = await user.client
      .from("plant_stats")
      .select("is_favourite, times_seen, times_correct")
      .eq("user_id", user.userId)
      .eq("plant_id", plantA)
      .single();
    expect(data).toMatchObject({ is_favourite: true, times_seen: 1, times_correct: 1 });
  });

  it("can be toggled back off", async () => {
    const user = await createTestUser("fav-untoggle");
    createdUsers.push(user);

    await toggleFavouriteCore(user.client, user.userId, plantA, true);
    await toggleFavouriteCore(user.client, user.userId, plantA, false);

    const ids = await getFavouritePlantIdsCore(user.client, user.userId);
    expect(ids).toEqual([]);
  });

  it("is scoped per-user — favouriting a plant doesn't affect another user's list", async () => {
    const userA = await createTestUser("fav-usera");
    const userB = await createTestUser("fav-userb");
    createdUsers.push(userA, userB);

    await toggleFavouriteCore(userA.client, userA.userId, plantA, true);

    const idsA = await getFavouritePlantIdsCore(userA.client, userA.userId);
    const idsB = await getFavouritePlantIdsCore(userB.client, userB.userId);
    expect(idsA).toEqual([plantA]);
    expect(idsB).toEqual([]);
  });
});

describe("getFavouritedPlantsCore", () => {
  it("returns full plant records for favourited plants, sorted alphabetically by scientific name", async () => {
    const user = await createTestUser("fav-list");
    createdUsers.push(user);

    // favourite in reverse-alphabetical order to prove sorting isn't just insertion order
    await toggleFavouriteCore(user.client, user.userId, plantA, true); // Zea...
    await toggleFavouriteCore(user.client, user.userId, plantB, true); // Abies...

    const plants = await getFavouritedPlantsCore(user.client, user.userId);
    expect(plants.map((p) => p.id)).toEqual([plantB, plantA]);
  });
});
