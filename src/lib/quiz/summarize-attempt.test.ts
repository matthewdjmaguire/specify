import { describe, expect, it } from "vitest";
import { summarizeAttempt, type NameQuestionRecord } from "./summarize-attempt";

function q(status: NameQuestionRecord["status"], habit: string | null, family: string | null = null): NameQuestionRecord {
  return { status, plant: { habit, family } };
}

describe("summarizeAttempt", () => {
  it("computes overall score and percent correct, counting unanswered as not correct", () => {
    const summary = summarizeAttempt([q("correct", "Tree"), q("incorrect", "Tree"), q("unanswered", "Tree")]);
    expect(summary.totalQuestions).toBe(3);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracyPercent).toBe(33);
  });

  it("handles zero questions without dividing by zero", () => {
    const summary = summarizeAttempt([]);
    expect(summary.accuracyPercent).toBe(0);
  });

  it("groups by habit, falling back to family when habit is missing", () => {
    const summary = summarizeAttempt([
      q("correct", "Tree"),
      q("correct", "Tree"),
      q("incorrect", null, "Ericaceae"),
      q("incorrect", null, "Ericaceae"),
    ]);
    const categories = [...summary.strengths, ...summary.focusAreas].map((s) => s.category);
    expect(categories).toContain("Tree");
    expect(categories).toContain("Ericaceae");
  });

  it("excludes categories with too few questions to be meaningful (min sample size 2)", () => {
    const summary = summarizeAttempt([q("incorrect", "Tree"), q("correct", "Shrub"), q("correct", "Shrub")]);
    const categories = [...summary.strengths, ...summary.focusAreas].map((s) => s.category);
    expect(categories).not.toContain("Tree");
    expect(categories).toContain("Shrub");
  });

  it("puts a category in strengths at >=75% accuracy and in focusAreas below it", () => {
    const summary = summarizeAttempt([
      q("correct", "Tree"),
      q("correct", "Tree"),
      q("correct", "Tree"),
      q("incorrect", "Tree"), // 3/4 = 75% -> strength
      q("incorrect", "Shrub"),
      q("incorrect", "Shrub"),
      q("correct", "Shrub"), // 1/3 = 33% -> focus area
    ]);
    expect(summary.strengths.map((s) => s.category)).toEqual(["Tree"]);
    expect(summary.focusAreas.map((s) => s.category)).toEqual(["Shrub"]);
  });

  it("sorts strengths highest-first and focus areas lowest-first, capped at 3", () => {
    const makeCategory = (name: string, correct: number, total: number) =>
      Array.from({ length: total }, (_, i) => q(i < correct ? "correct" : "incorrect", name));
    const summary = summarizeAttempt([
      ...makeCategory("A", 2, 2), // 100%
      ...makeCategory("B", 0, 2), // 0%
      ...makeCategory("C", 1, 2), // 50%
      ...makeCategory("D", 2, 2), // 100% (ties with A)
    ]);
    expect(summary.strengths.map((s) => s.category)).toEqual(
      expect.arrayContaining(["A", "D"]),
    );
    expect(summary.focusAreas.map((s) => s.category)).toEqual(["B", "C"]);
  });
});
