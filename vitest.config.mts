import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // why: vitest's default include glob (**/*.spec.ts) otherwise picks up
    // the Playwright e2e specs too — those use Playwright's own `test`
    // global (test.use(), fixtures), which isn't valid under vitest's.
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // why: parallel RLS test files each sign up real Supabase Auth users —
    // Supabase's auth endpoints rate-limit rapid sign-ups, and running test
    // files in parallel (Vitest's default) reliably trips that limit once
    // there's more than a couple of *.rls.test.ts files (this is the exact
    // issue Bean Counter v2's RLS suite hit).
    fileParallelism: false,
    // why 15s, not vitest's 5s default: every *.rls.test.ts file does real
    // Supabase Auth sign-ins (not mocked) — a single test creating even two
    // test users sequentially can legitimately take longer than 5s under
    // any latency/load variance, which isn't a hang, just real network
    // round-trips. Hit this three separate times this session (once needing
    // its own even-higher override for a much heavier bulk-DB test) before
    // raising the suite-wide default instead of patching tests one at a time.
    testTimeout: 15000,
  },
});
