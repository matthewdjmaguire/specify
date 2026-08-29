import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL_SUFFIX = "@spec004-test.invalid";

teardown("delete e2e test users", async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const stale = data.users.filter((u) => u.email?.startsWith("e2e-") && u.email.endsWith(TEST_EMAIL_SUFFIX));
  for (const user of stale) {
    await admin.auth.admin.deleteUser(user.id);
  }
});
