import { afterAll, describe, expect, it } from "vitest";
import { cleanupAllTestUsers, createTestUser, deleteTestUser, type TestUser } from "@/test/rls-test-helpers";
import { resolveThemePlants } from "./resolve-theme-plants";

const createdUsers: TestUser[] = [];

afterAll(async () => {
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
});

describe("resolveThemePlants (against the live plants table)", () => {
  it("Lucky Dip returns a large, unfiltered set regardless of prompt text", async () => {
    const user = await createTestUser("luckydip-resolve");
    createdUsers.push(user);

    const plants = await resolveThemePlants(user.client, { prompt: "", isLuckyDip: true }, "Global");
    // why >= 200, not an exact count: the real seed set (264 as of SPEC-001)
    // will keep growing — this asserts "Lucky Dip is genuinely unfiltered
    // against the real catalogue", not a brittle exact number.
    expect(plants.length).toBeGreaterThanOrEqual(200);
    expect(plants.every((p) => p.scientificName.length > 0)).toBe(true);
  });

  it("UK geo scope returns a strict subset of Global scope", async () => {
    const user = await createTestUser("georange-resolve");
    createdUsers.push(user);

    const [ukPlants, globalPlants] = await Promise.all([
      resolveThemePlants(user.client, { prompt: "", isLuckyDip: true }, "UK"),
      resolveThemePlants(user.client, { prompt: "", isLuckyDip: true }, "Global"),
    ]);

    expect(ukPlants.length).toBeGreaterThan(0);
    expect(ukPlants.length).toBeLessThan(globalPlants.length);
  });

  it("a real prompt narrows the real catalogue to a smaller, relevant subset", async () => {
    const user = await createTestUser("prompt-resolve");
    createdUsers.push(user);

    const [acers, all] = await Promise.all([
      resolveThemePlants(user.client, { prompt: "acer", isLuckyDip: false }, "Global"),
      resolveThemePlants(user.client, { prompt: "", isLuckyDip: true }, "Global"),
    ]);

    expect(acers.length).toBeGreaterThan(0);
    expect(acers.length).toBeLessThan(all.length);
    expect(acers.every((p) => p.genus === "Acer")).toBe(true);
  });
});
