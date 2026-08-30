import { afterAll, describe, expect, it } from "vitest";
import { createImportJobCore, getImportJobsCore } from "./plant-import";
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
