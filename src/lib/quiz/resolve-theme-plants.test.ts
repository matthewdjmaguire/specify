import { describe, expect, it } from "vitest";
import { filterPlantsByPrompt } from "./resolve-theme-plants";
import type { QuizPlant } from "./types";

function plant(overrides: Partial<QuizPlant>): QuizPlant {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    scientificName: "Testus plantus",
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

describe("filterPlantsByPrompt", () => {
  it("matches on genus", () => {
    const acer = plant({ scientificName: "Acer palmatum", genus: "Acer" });
    const oak = plant({ scientificName: "Quercus robur", genus: "Quercus" });
    expect(filterPlantsByPrompt([acer, oak], "acer")).toEqual([acer]);
  });

  it("matches a plural prompt against a singular field value (e.g. 'trees' -> habit 'Tree')", () => {
    const tree = plant({ scientificName: "Acer palmatum", habit: "Tree" });
    const shrub = plant({ scientificName: "Buxus sempervirens", habit: "Bushy" });
    expect(filterPlantsByPrompt([tree, shrub], "trees")).toEqual([tree]);
  });

  it("matches on structured characteristic fields, not just name/family", () => {
    const shadeLover = plant({ scientificName: "Hosta 'Blue Mountains'", position: ["Partial shade"] });
    const sunLover = plant({ scientificName: "Lavandula angustifolia", position: ["Full sun"] });
    expect(filterPlantsByPrompt([shadeLover, sunLover], "shade")).toEqual([shadeLover]);
  });

  it("matches on soil type", () => {
    const clayPlant = plant({ scientificName: "Viburnum opulus", soilTypes: ["Clay", "Loam"] });
    const sandPlant = plant({ scientificName: "Cistus 'Sunset'", soilTypes: ["Sand"] });
    expect(filterPlantsByPrompt([clayPlant, sandPlant], "clay soil")).toEqual([clayPlant]);
  });

  it("is case-insensitive and matches multi-word prompts as OR, not AND", () => {
    const acer = plant({ genus: "Acer" });
    const oak = plant({ habit: "Tree" });
    const daisy = plant({ genus: "Bellis" });
    const result = filterPlantsByPrompt([acer, oak, daisy], "ACER or Trees");
    expect(result).toEqual([acer, oak]);
  });

  it("returns every plant unfiltered for a blank prompt", () => {
    const plants = [plant({}), plant({})];
    expect(filterPlantsByPrompt(plants, "")).toEqual(plants);
    expect(filterPlantsByPrompt(plants, "   ")).toEqual(plants);
  });

  it("treats a prompt that tokenizes to nothing usable (all stopword-length words) as unfiltered", () => {
    // why unfiltered, not "no matches": once every word in the prompt is
    // dropped as too short to be a useful keyword, there is nothing left to
    // filter on — same as a blank prompt, not a stricter "match nothing".
    const plants = [plant({ description: "A shrub found in gardens" })];
    expect(filterPlantsByPrompt(plants, "in a")).toEqual(plants);
  });

  it("returns no matches when nothing in the prompt appears in any plant", () => {
    const plants = [plant({ genus: "Rosa" }), plant({ genus: "Quercus" })];
    expect(filterPlantsByPrompt(plants, "orchids")).toEqual([]);
  });
});
