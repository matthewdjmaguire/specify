import { defineConfig, devices } from "@playwright/test";

// why loadEnvFile rather than a webServer block that starts `next dev`
// itself: this suite runs against whatever's already running at baseURL
// (local dev today, a real deploy later) rather than owning the server's
// lifecycle — matches how the ticket frames it ("passes against a preview
// deploy"), not a self-contained local-only harness.
process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      teardown: "teardown",
    },
    { name: "teardown", testMatch: /auth\.teardown\.ts/ },
  ],
});
