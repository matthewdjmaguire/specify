import { afterAll, describe, expect, it } from "vitest";
import { deleteUserCore, getAdminDirectoryCore, inviteUserCore, setUserAdminCore } from "@/app/actions/admin";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  getPrimaryAdminUserId,
  type TestUser,
} from "./rls-test-helpers";

const createdUsers: TestUser[] = [];
// why tracked separately, not cascaded from a test user: allowed_emails
// rows aren't owned by any user (no FK to cascade through) — same gap
// CLAUDE.md's Learnings documents for other shared/global tables.
const createdAllowedEmails: string[] = [];

async function newTestUser(label: string): Promise<TestUser> {
  const user = await createTestUser(label);
  createdUsers.push(user);
  return user;
}

function testEmail(label: string): string {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@spec-invite-test.invalid`;
  createdAllowedEmails.push(email);
  return email;
}

async function promoteToAdmin(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
  if (error) throw error;
}

afterAll(async () => {
  const admin = createServiceRoleClient();
  if (createdAllowedEmails.length > 0) {
    const { error } = await admin.from("allowed_emails").delete().in("email", createdAllowedEmails);
    if (error) console.error("Failed to clean up test allowed_emails:", error);
  }
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

describe("inviteUserCore", () => {
  it("rejects a non-admin acting user", async () => {
    const nonAdmin = await newTestUser("invite-nonadmin");
    await expect(inviteUserCore(nonAdmin.client, nonAdmin.userId, testEmail("invite-rejected"))).rejects.toThrow(
      "Admin access required",
    );
  });

  it("rejects an invalid email address", async () => {
    const admin = await newTestUser("invite-bademail");
    await promoteToAdmin(admin.userId);

    await expect(inviteUserCore(admin.client, admin.userId, "not-an-email")).rejects.toThrow(
      "Enter a valid email address",
    );
  });

  it("adds a brand-new email to the allow-list, idempotently", async () => {
    const admin = await newTestUser("invite-new");
    await promoteToAdmin(admin.userId);
    const email = testEmail("invite-new-target");

    const first = await inviteUserCore(admin.client, admin.userId, email);
    expect(first).toEqual({ alreadyInvited: false, unlockedExistingAccount: false });

    const { data } = await createServiceRoleClient().from("allowed_emails").select("email").eq("email", email).maybeSingle();
    expect(data?.email).toBe(email);

    const second = await inviteUserCore(admin.client, admin.userId, email);
    expect(second).toEqual({ alreadyInvited: true, unlockedExistingAccount: false });
  });

  it("normalizes email case/whitespace before checking the allow-list", async () => {
    const admin = await newTestUser("invite-normalize");
    await promoteToAdmin(admin.userId);
    const email = testEmail("invite-normalize-target");

    await inviteUserCore(admin.client, admin.userId, email);
    const second = await inviteUserCore(admin.client, admin.userId, `  ${email.toUpperCase()}  `);
    expect(second.alreadyInvited).toBe(true);
  });

  it("unlocks an existing account whose profile was never allowed, without needing a second invite", async () => {
    const admin = await newTestUser("invite-unlock-admin");
    await promoteToAdmin(admin.userId);
    // why not testEmail() here: this target needs a real auth.users row
    // (via createTestUser), whose email createTestUser generates itself —
    // still tracked below via deleteTestUser in createdUsers, not
    // createdAllowedEmails, since it's a real user row, not a bare
    // allow-list entry.
    const target = await newTestUser("invite-unlock-target");
    await createServiceRoleClient().from("profiles").update({ is_allowed: false }).eq("id", target.userId);

    const result = await inviteUserCore(admin.client, admin.userId, target.email);
    expect(result).toEqual({ alreadyInvited: false, unlockedExistingAccount: true });
    createdAllowedEmails.push(target.email.toLowerCase());

    const { data } = await createServiceRoleClient().from("profiles").select("is_allowed").eq("id", target.userId).single();
    expect(data?.is_allowed).toBe(true);
  });
});
