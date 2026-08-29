import { test, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "./auth-files";

test.use({ storageState: ADMIN_AUTH_FILE });

// why matching against real phrases used elsewhere in the app (the
// homepage's "N quizzes completed", "X% correct", "Focus areas", plant
// mastery's times_seen/times_correct), not just eyeballing the page: this
// is the actual assertion behind "Admin data-minimisation is asserted in a
// test, not just trusted" — proving the rendered page contains none of the
// vocabulary quiz data would show up as, not just that it looks fine today.
test("the admin directory renders identity fields only, never quiz data", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  for (const forbidden of [
    /quizzes? completed/i,
    /%\s*correct/i,
    /focus areas/i,
    /accuracy/i,
    /times_seen/i,
    /times_correct/i,
    /most quizzed/i,
  ]) {
    expect(bodyText).not.toMatch(forbidden);
  }
});

test("the primary admin row cannot be demoted or deleted from the UI", async ({ page }) => {
  await page.goto("/admin");
  const primaryRow = page.getByTestId("user-row").filter({ hasText: "Primary admin" });
  await expect(primaryRow.getByRole("button", { name: /demote|promote/i })).toBeDisabled();
  await expect(primaryRow.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
});
