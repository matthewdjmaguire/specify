import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { USER_AUTH_FILE, USER_CONTEXT_FILE, type UserContext } from "./auth-files";

test.use({ storageState: USER_AUTH_FILE });

// why read lazily, not at module scope: Playwright discovers/parses every
// test file across all projects before running any of them — a module-
// scope read would run before the "setup" project (which writes this file)
// has actually executed, even though the "chromium" project correctly
// depends on "setup" at run time.
function smallThemeId(): string {
  return (JSON.parse(readFileSync(USER_CONTEXT_FILE, "utf8")) as UserContext).smallThemeId;
}

// why "skip every third interactive step" rather than always answering: the
// ticket asks for a mix of correct/incorrect/skipped, not just correct/
// incorrect — clicking the first option or typing a guess naturally
// produces a real mix of right/wrong (this suite doesn't know or care which
// plant is shown), and periodically clicking Next without answering covers
// "skipped" without needing per-plant knowledge.
async function runQuizToCompletion(page: Page, mode: "learning" | "intermediate" | "hard") {
  await page.goto(`/quiz/${smallThemeId()}`);
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByTestId("start-quiz").click();
  await page.waitForURL(/\/quiz\/[^/]+\/[^/]+$/);

  let step = 0;
  for (let guard = 0; guard < 200; guard++) {
    const shouldSkip = step % 3 === 2;
    step++;

    if (!shouldSkip) {
      const hardInput = page.getByTestId("hard-answer-input");
      const answerOption = page.getByTestId("answer-option").first();
      if (await hardInput.isVisible()) {
        await hardInput.fill("Testus guessii");
        await page.getByTestId("hard-answer-submit").click();
      } else if (await answerOption.isVisible()) {
        await answerOption.click();
      }
    }

    const finishButton = page.getByTestId("quiz-finish");
    if (await finishButton.isVisible()) {
      await finishButton.click();
      break;
    }
    await page.getByTestId("quiz-next").click();
  }

  await page.waitForURL(/\/summary$/);
  await expect(page.getByRole("heading", { name: "Quiz complete" })).toBeVisible();
}

test.describe("golden path", () => {
  for (const mode of ["learning", "intermediate", "hard"] as const) {
    test(`sign in → run a ${mode} quiz → reach the summary`, async ({ page }) => {
      await runQuizToCompletion(page, mode);
    });
  }

  test("the summary's Create Quiz link leads to the new-theme form", async ({ page }) => {
    await runQuizToCompletion(page, "intermediate");
    await page.getByRole("link", { name: /create a quiz|practice/i }).click();
    await expect(page).toHaveURL(/\/settings\/quizzes\/new/);
    await expect(page.getByRole("heading", { name: "New quiz theme" })).toBeVisible();
  });
});
