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
    // why: parallel RLS test files each sign up real Supabase Auth users —
    // Supabase's auth endpoints rate-limit rapid sign-ups, and running test
    // files in parallel (Vitest's default) reliably trips that limit once
    // there's more than a couple of *.rls.test.ts files (this is the exact
    // issue Bean Counter v2's RLS suite hit).
    fileParallelism: false,
  },
});
