import { afterAll, describe, expect, it } from "vitest";
import {
  cleanupAllTestUsers,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./rls-test-helpers";

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
  // why: an interrupted previous run (timeout, killed process) can leave
  // stray test users behind — BC2 hit exactly this and found ~25 accumulated
  // over a session. Sweeping by the test-only email suffix here means it
  // self-heals on the next successful run instead of silently accumulating.
  await cleanupAllTestUsers().catch(() => {});
});

describe("profiles RLS", () => {
  it("auto-provisions a profiles row on signup, not allowed by default", async () => {
    const user = await newTestUser("signup");
    const { data, error } = await user.client
      .from("profiles")
      .select("id, is_allowed, is_admin, is_primary_admin, geo_scope, quiz_length, followup_count")
      .eq("id", user.userId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      is_allowed: false,
      is_admin: false,
      is_primary_admin: false,
      geo_scope: "UK",
      quiz_length: 20,
      followup_count: 1,
    });
  });

  it("lets a user update their own display_name", async () => {
    const user = await newTestUser("selfupdate");
    const { error } = await user.client
      .from("profiles")
      .update({ display_name: "New Name" })
      .eq("id", user.userId);
    expect(error).toBeNull();

    const { data } = await user.client
      .from("profiles")
      .select("display_name")
      .eq("id", user.userId)
      .single();
    expect(data?.display_name).toBe("New Name");
  });

  it("cannot self-escalate is_admin via the client", async () => {
    const user = await newTestUser("escalate");
    const { error } = await user.client
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", user.userId);

    // why: this is the single most important assertion in this file — the
    // profiles_guard trigger must actively reject the write (not silently
    // ignore it), so a compromised/malicious client gets a clear failure
    // rather than a misleading "success" with no real effect.
    expect(error).not.toBeNull();

    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("is_admin").eq("id", user.userId).single();
    expect(data?.is_admin).toBe(false);
  });

  it("cannot self-escalate is_allowed or is_primary_admin via the client", async () => {
    const user = await newTestUser("escalate2");
    const { error: allowedError } = await user.client
      .from("profiles")
      .update({ is_allowed: true })
      .eq("id", user.userId);
    expect(allowedError).not.toBeNull();

    const { error: primaryError } = await user.client
      .from("profiles")
      .update({ is_primary_admin: true })
      .eq("id", user.userId);
    expect(primaryError).not.toBeNull();
  });

  it("cannot read another user's profile row", async () => {
    const userA = await newTestUser("reada");
    const userB = await newTestUser("readb");

    const { data, error } = await userB.client
      .from("profiles")
      .select("*")
      .eq("id", userA.userId);

    // RLS makes another user's row simply not appear (no error, empty result)
    // rather than a 403 — this is standard Postgres RLS behaviour, so assert
    // the row is invisible, not that the query fails outright.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read or write allowed_emails at all as a normal user", async () => {
    const user = await newTestUser("allowlist");
    const { data: readData, error: readError } = await user.client
      .from("allowed_emails")
      .select("*");
    expect(readError).toBeNull();
    expect(readData).toEqual([]);

    const { error: writeError } = await user.client
      .from("allowed_emails")
      .insert({ email: "someone@example.com" });
    expect(writeError).not.toBeNull();
  });

  it("service-role can set is_admin (the path admin server actions use)", async () => {
    const user = await newTestUser("adminaction");
    const admin = createServiceRoleClient();
    const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", user.userId);
    expect(error).toBeNull();

    const { data } = await admin.from("profiles").select("is_admin").eq("id", user.userId).single();
    expect(data?.is_admin).toBe(true);
  });

  it("blocks demoting or deleting a primary-admin row, even via service-role", async () => {
    const user = await newTestUser("primaryadmin");
    const admin = createServiceRoleClient();

    // Promote to primary admin first (simulating the seeded matthewdjmaguire@gmail.com row).
    const { error: promoteError } = await admin
      .from("profiles")
      .update({ is_admin: true, is_primary_admin: true })
      .eq("id", user.userId);
    expect(promoteError).toBeNull();

    const { error: demoteError } = await admin
      .from("profiles")
      .update({ is_admin: false })
      .eq("id", user.userId);
    expect(demoteError).not.toBeNull();

    const { error: deleteError } = await admin.from("profiles").delete().eq("id", user.userId);
    expect(deleteError).not.toBeNull();
  });
});
