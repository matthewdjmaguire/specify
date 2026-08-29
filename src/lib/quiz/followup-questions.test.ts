import { describe, expect, it } from "vitest";
import {
  buildFollowupQuestion,
  followupCategoryValue,
  selectFollowupCategories,
} from "./followup-questions";
import type { QuizPlant } from "./types";

function plant(overrides: Partial<QuizPlant> & { id: string }): QuizPlant {
  return {
    scientificName: overrides.id,
    commonName: null,
    description: null,
    imageUrl: "https://example.com/a.jpg",
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

describe("selectFollowupCategories", () => {
  it("only selects categories the plant actually has data for", () => {
    const sparse = plant({ id: "p1", hardiness: "H4", heightRange: null, spreadRange: null });
    const categories = selectFollowupCategories(sparse, 5);
    expect(categories).toEqual(["hardiness"]);
  });

  it("respects the requested count when enough categories are populated", () => {
    const rich = plant({
      id: "p1",
      soilTypes: ["Clay"],
      hardiness: "H4",
      position: ["Full sun"],
      heightRange: "1-2 metres",
      spreadRange: "1-2 metres",
    });
    expect(selectFollowupCategories(rich, 3)).toHaveLength(3);
    expect(selectFollowupCategories(rich, 5)).toHaveLength(5);
  });

  it("returns nothing for a plant with no characteristic data at all", () => {
    expect(selectFollowupCategories(plant({ id: "empty" }), 3)).toEqual([]);
  });
});

describe("buildFollowupQuestion", () => {
  it("returns null when the plant has no value for that category", () => {
    const noHardiness = plant({ id: "p1", hardiness: null });
    expect(buildFollowupQuestion(noHardiness, "hardiness", [noHardiness])).toBeNull();
  });

  it("builds options from real values on other plants, including the correct one", () => {
    const correct = plant({ id: "correct", hardiness: "H4" });
    const pool = [
      correct,
      plant({ id: "a", hardiness: "H5" }),
      plant({ id: "b", hardiness: "H6" }),
      plant({ id: "c", hardiness: "H2" }),
    ];
    const question = buildFollowupQuestion(correct, "hardiness", pool);
    expect(question).not.toBeNull();
    expect(question!.correctValue).toBe("H4");
    expect(question!.options).toContain("H4");
    expect(question!.options).toHaveLength(4);
    expect(new Set(question!.options).size).toBe(4);
  });

  it("never offers the correct value twice, even if several other plants share it", () => {
    const correct = plant({ id: "correct", hardiness: "H4" });
    const pool = [
      correct,
      plant({ id: "a", hardiness: "H4" }), // same value as correct
      plant({ id: "b", hardiness: "H5" }),
      plant({ id: "c", hardiness: "H6" }),
    ];
    const question = buildFollowupQuestion(correct, "hardiness", pool);
    expect(question!.options.filter((o) => o === "H4")).toHaveLength(1);
  });

  it("handles array-valued categories (soil, position) as joined display strings", () => {
    const correct = plant({ id: "correct", soilTypes: ["Clay", "Loam"] });
    const pool = [correct, plant({ id: "a", soilTypes: ["Sand"] }), plant({ id: "b", soilTypes: ["Chalk"] })];
    const question = buildFollowupQuestion(correct, "soil", pool);
    expect(question!.correctValue).toBe("Clay, Loam");
  });

  it("returns fewer than 4 options rather than crashing when the pool lacks variety", () => {
    const correct = plant({ id: "correct", hardiness: "H4" });
    const question = buildFollowupQuestion(correct, "hardiness", [correct]);
    expect(question!.options).toEqual(["H4"]);
  });
});

describe("followupCategoryValue", () => {
  it("returns null, not an empty string, for an unpopulated scalar field", () => {
    expect(followupCategoryValue(plant({ id: "p1" }), "hardiness")).toBeNull();
  });

  it("returns null, not an empty string, for an unpopulated array field", () => {
    expect(followupCategoryValue(plant({ id: "p1" }), "soil")).toBeNull();
  });
});
