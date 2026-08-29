import { describe, expect, it } from "vitest";
import { selectDistractors } from "./select-distractors";
import type { QuizPlant } from "./types";

function plant(overrides: Partial<QuizPlant> & { id: string }): QuizPlant {
  return {
    scientificName: overrides.id,
    commonName: null,
    description: null,
    imageUrl: "https://example.com/a.jpg",
    sourceUrl: null,
    family: null,
    genus: null,
    habit: null,
    foliage: null,
    soilTypes: [],
    moisture: null,
    ph: null,
    position: [],
    aspect: null,
    exposure: null,
    hardiness: null,
    heightRange: null,
    spreadRange: null,
    ...overrides,
  };
}

describe("selectDistractors", () => {
  it("never includes the correct plant itself", () => {
    const correct = plant({ id: "correct", family: "Sapindaceae" });
    const pool = [correct, plant({ id: "a", family: "Sapindaceae" }), plant({ id: "b" }), plant({ id: "c" })];
    const distractors = selectDistractors(correct, pool, 3);
    expect(distractors.some((d) => d.id === "correct")).toBe(false);
  });

  it("never duplicates a distractor", () => {
    const correct = plant({ id: "correct" });
    const pool = [correct, plant({ id: "a" }), plant({ id: "b" }), plant({ id: "c" })];
    const distractors = selectDistractors(correct, pool, 3);
    expect(new Set(distractors.map((d) => d.id)).size).toBe(distractors.length);
  });

  it("prefers same-family candidates over unrelated ones", () => {
    const correct = plant({ id: "correct", family: "Sapindaceae" });
    const sameFamily = plant({ id: "same-family", family: "Sapindaceae" });
    const unrelated = Array.from({ length: 20 }, (_, i) => plant({ id: `unrelated-${i}`, family: "Other" }));
    const pool = [correct, sameFamily, ...unrelated];

    // Run many times (real Math.random) — the one same-family candidate
    // should be picked essentially every time, not just occasionally,
    // since it's tried before falling back to the 20 unrelated ones.
    let includedCount = 0;
    for (let i = 0; i < 100; i++) {
      const distractors = selectDistractors(correct, pool, 3);
      if (distractors.some((d) => d.id === "same-family")) includedCount++;
    }
    expect(includedCount).toBe(100);
  });

  it("falls back to habit, then to anything, when family alone isn't enough", () => {
    const correct = plant({ id: "correct", family: "Sapindaceae", habit: "Tree" });
    const sameFamily = plant({ id: "same-family", family: "Sapindaceae", habit: "Bushy" });
    const sameHabit = plant({ id: "same-habit", family: "Other", habit: "Tree" });
    const unrelated = plant({ id: "unrelated", family: "Other", habit: "Other" });
    const pool = [correct, sameFamily, sameHabit, unrelated];

    const distractors = selectDistractors(correct, pool, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors.map((d) => d.id).sort()).toEqual(["same-family", "same-habit", "unrelated"]);
  });

  it("returns fewer than requested rather than crashing when the pool is too small", () => {
    const correct = plant({ id: "correct" });
    const pool = [correct, plant({ id: "only-other" })];
    const distractors = selectDistractors(correct, pool, 3);
    expect(distractors).toEqual([expect.objectContaining({ id: "only-other" })]);
  });
});
