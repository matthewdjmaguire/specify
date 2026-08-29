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
  },
});
