import { afterAll, describe, expect, it } from "vitest";
import { createBulkImportJobsCore, createImportJobCore, ensureCategoryMinimumsCore, getImportJobsCore } from "./plant-import";
import { GENUS_CATEGORIES, allGenera } from "../../../scripts/lib/genus-list";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "@/test/rls-test-helpers";

const createdUsers: TestUser[] = [];
const createdJobIds: string[] = [];

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
  for (const id of createdJobIds) {
    try {
      await admin.from("plant_import_jobs").delete().eq("id", id);
    } catch {
      // best-effort cleanup
    }
  }
  // why also swept by requested_by, not just createdJobIds: bulk-created
  // jobs' ids aren't known ahead of time (which genera get queued depends
  // on the live catalogue's current counts) — sweeping every job this
  // test's admin users requested covers those regardless.
  const testUserIds = createdUsers.map((u) => u.userId);
  if (testUserIds.length > 0) {
    try {
      await admin.from("plant_import_jobs").delete().in("requested_by", testUserIds);
    } catch {
      // best-effort cleanup
    }
  }
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
});

describe("createImportJobCore", () => {
  it("rejects a non-admin acting user", async () => {
    const user = await newTestUser("import-nonadmin");
    await expect(createImportJobCore(user.client, user.userId, "camellia", 10)).rejects.toThrow(
      "Admin access required",
    );
  });

  it("rejects a genus that isn't a plain lowercase word", async () => {
    const admin = await newTestUser("import-admin1");
    await promoteToAdmin(admin.userId);
    await expect(createImportJobCore(admin.client, admin.userId, "Camellia japonica", 10)).rejects.toThrow(
      /single lowercase word/,
    );
  });

  it("rejects a target count outside 1-100", async () => {
    const admin = await newTestUser("import-admin2");
    await promoteToAdmin(admin.userId);
    await expect(createImportJobCore(admin.client, admin.userId, "camellia", 0)).rejects.toThrow(/between 1 and 100/);
    await expect(createImportJobCore(admin.client, admin.userId, "camellia", 101)).rejects.toThrow(
      /between 1 and 100/,
    );
  });

  it("lets an admin create a job, lower-casing the genus, visible via getImportJobsCore", async () => {
    const admin = await newTestUser("import-admin3");
    await promoteToAdmin(admin.userId);

    await createImportJobCore(admin.client, admin.userId, "CAMELLIA", 5);

    const jobs = await getImportJobsCore(admin.client);
    const created = jobs.find((j) => j.genus === "camellia" && j.targetCount === 5);
    expect(created).toBeDefined();
    expect(created?.status).toBe("pending");
    if (created) createdJobIds.push(created.id);
  });
});

describe("createBulkImportJobsCore", () => {
  it("rejects a non-admin acting user", async () => {
    const user = await newTestUser("bulkimport-nonadmin");
    await expect(createBulkImportJobsCore(user.client, user.userId, 1)).rejects.toThrow("Admin access required");
  });

  it("rejects a target count outside 1-100", async () => {
    const admin = await newTestUser("bulkimport-admin1");
    await promoteToAdmin(admin.userId);
    await expect(createBulkImportJobsCore(admin.client, admin.userId, 0)).rejects.toThrow(/between 1 and 100/);
    await expect(createBulkImportJobsCore(admin.client, admin.userId, 101)).rejects.toThrow(/between 1 and 100/);
  });

  // why a longer explicit timeout: this test does real work proportional to
  // the curated genus list (two full createBulkImportJobsCore calls, each
  // scanning/inserting across up to ~85 genera) on top of a real auth
  // sign-in — comfortably over vitest's 5s default under CI's shared-runner
  // latency, even though it's not actually hanging.
  it("queues at most one job per curated genus, and skips on a repeat call", async () => {
    const admin = await newTestUser("bulkimport-admin2");
    await promoteToAdmin(admin.userId);
    const totalCuratedGenera = allGenera().length;

    // why target=1: minimizes how many genera actually need a fresh job
    // against the live catalogue (most curated genera already have at
    // least a few plants from the original seed) — keeps this test's real
    // side effects on the shared plant_import_jobs table small.
    const first = await createBulkImportJobsCore(admin.client, admin.userId, 1);
    expect(first.queuedCount + first.skippedCount).toBe(totalCuratedGenera);

    // every genus queued by the first call now has a pending job, so a
    // second call at the same target must skip all of them — proves the
    // "already has an active job" guard, independent of exact catalogue
    // counts.
    const second = await createBulkImportJobsCore(admin.client, admin.userId, 1);
    expect(second.queuedCount).toBe(0);
    expect(second.skippedCount).toBe(totalCuratedGenera);
  }, 30000);
});

describe("ensureCategoryMinimumsCore", () => {
  it("rejects a non-admin acting user", async () => {
    const user = await newTestUser("category-nonadmin");
    await expect(ensureCategoryMinimumsCore(user.client, user.userId, 100)).rejects.toThrow("Admin access required");
  });

  it("rejects a non-positive minimum", async () => {
    const admin = await newTestUser("category-admin1");
    await promoteToAdmin(admin.userId);
    await expect(ensureCategoryMinimumsCore(admin.client, admin.userId, 0)).rejects.toThrow(/positive whole number/);
  });

  it("queues nothing when every category is already comfortably above the minimum", async () => {
    const admin = await newTestUser("category-admin2");
    await promoteToAdmin(admin.userId);

    // why min=1: every curated category has real plants from the original
    // seed (dozens, not zero) — a threshold this low should never need to
    // queue anything against the live catalogue, so this is a genuine,
    // side-effect-free assertion, not a contrived one.
    const result = await ensureCategoryMinimumsCore(admin.client, admin.userId, 1);
    expect(result.queuedCount).toBe(0);
    expect(result.categoriesNeedingWork).toEqual([]);
  });

  // why a high threshold, not one call per real category size: forces every
  // category to need work regardless of the live catalogue's current
  // counts, so this test's assertions don't depend on (and don't drift
  // with) exactly how many plants happen to exist right now.
  it("queues jobs across every genus in every category once the minimum is unreachably high", async () => {
    const admin = await newTestUser("category-admin3");
    await promoteToAdmin(admin.userId);
    const totalCuratedGenera = allGenera().length;

    const result = await ensureCategoryMinimumsCore(admin.client, admin.userId, 100000);
    expect(result.categoriesNeedingWork.sort()).toEqual(Object.keys(GENUS_CATEGORIES).sort());
    expect(result.queuedCount + result.skippedCount).toBe(totalCuratedGenera);
  }, 30000);
});
