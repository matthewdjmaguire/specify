import { test, expect } from "@playwright/test";
import { USER_AUTH_FILE } from "./auth-files";

test.use({ storageState: USER_AUTH_FILE });

test("changing a setting persists across a reload", async ({ page }) => {
  await page.goto("/settings");

  // why Global specifically, not just "some other option": the test user's
  // profile defaults to UK (the app default), so switching to Global and
  // reloading is a real change-and-persist check, not a no-op.
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Global", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "UK", exact: true })).toHaveAttribute("aria-pressed", "false");
});
