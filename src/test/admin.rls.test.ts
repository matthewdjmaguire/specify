import { afterAll, describe, expect, it } from "vitest";
import { deleteUserCore, getAdminDirectoryCore, setUserAdminCore } from "@/app/actions/admin";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  getPrimaryAdminUserId,
  type TestUser,
} from "./rls-test-helpers";

const createdUsers: TestUser[] = [];

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
  for (const user of createdUsers) {
    await deleteTestUser(user.userId).catch(() => {});
  }
  await cleanupAllTestUsers().catch(() => {});
});

describe("admin_user_directory RPC (getAdminDirectoryCore)", () => {
  it("returns nothing to a non-admin caller", async () => {
    const user = await newTestUser("directory-nonadmin");
    const entries = await getAdminDirectoryCore(user.client);
    expect(entries).toEqual([]);
  });

  it("returns only identity fields to an admin caller, for every user including others", async () => {
    const admin = await newTestUser("directory-admin");
    await promoteToAdmin(admin.userId);
    const other = await newTestUser("directory-other");

    const entries = await getAdminDirectoryCore(admin.client);
    const otherEntry = entries.find((e) => e.id === other.userId);
    expect(otherEntry).toMatchObject({ id: other.userId, email: other.email, isAdmin: false, isPrimaryAdmin: false });

    // structural proof this can never carry quiz data: every entry has
    // exactly these five keys, nothing else — no aggregation query could
    // smuggle quiz_attempts/plant_stats through this shape.
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(["displayName", "email", "id", "isAdmin", "isPrimaryAdmin"].sort());
    }
  });
});

describe("setUserAdminCore", () => {
  it("rejects a non-admin acting user", async () => {
    const nonAdmin = await newTestUser("setadmin-nonadmin");
    const target = await newTestUser("setadmin-target1");
    await expect(setUserAdminCore(nonAdmin.client, nonAdmin.userId, target.userId, true)).rejects.toThrow(
      "Admin access required",
    );
  });

  it("lets an admin promote another user", async () => {
    const admin = await newTestUser("setadmin-admin1");
    await promoteToAdmin(admin.userId);
    const target = await newTestUser("setadmin-target2");

    await setUserAdminCore(admin.client, admin.userId, target.userId, true);

    const { data } = await createServiceRoleClient().from("profiles").select("is_admin").eq("id", target.userId).single();
    expect(data?.is_admin).toBe(true);
  });

  it("blocks an admin from demoting themselves", async () => {
    const admin = await newTestUser("setadmin-self");
    await promoteToAdmin(admin.userId);

    await expect(setUserAdminCore(admin.client, admin.userId, admin.userId, false)).rejects.toThrow(
      "You cannot remove your own admin access",
    );
  });

  it("blocks demoting the primary admin, even by another admin", async () => {
    const admin = await newTestUser("setadmin-admin2");
    await promoteToAdmin(admin.userId);
    const primaryAdminId = await getPrimaryAdminUserId();

    await expect(setUserAdminCore(admin.client, admin.userId, primaryAdminId, false)).rejects.toThrow(
      "The primary admin cannot be demoted",
    );
  });
});

describe("deleteUserCore", () => {
  it("rejects a non-admin acting user", async () => {
    const nonAdmin = await newTestUser("deleteuser-nonadmin");
    const target = await newTestUser("deleteuser-target1");
    await expect(deleteUserCore(nonAdmin.client, nonAdmin.userId, target.userId)).rejects.toThrow(
      "Admin access required",
    );
  });

  it("lets an admin delete a normal user", async () => {
    const admin = await newTestUser("deleteuser-admin1");
    await promoteToAdmin(admin.userId);
    const target = await createTestUser("deleteuser-target2"); // not pushed to createdUsers — deleted by the action itself

    await deleteUserCore(admin.client, admin.userId, target.userId);

    const { data } = await createServiceRoleClient().from("profiles").select("id").eq("id", target.userId).maybeSingle();
    expect(data).toBeNull();
  });

  it("blocks deleting the primary admin, even by another admin", async () => {
    const admin = await newTestUser("deleteuser-admin2");
    await promoteToAdmin(admin.userId);
    const primaryAdminId = await getPrimaryAdminUserId();

    await expect(deleteUserCore(admin.client, admin.userId, primaryAdminId)).rejects.toThrow(
      "The primary admin cannot be deleted",
    );
  });
});
