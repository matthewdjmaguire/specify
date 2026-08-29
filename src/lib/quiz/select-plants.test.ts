import { describe, expect, it } from "vitest";
import { selectQuizPlants, weightedSampleWithoutReplacement } from "./select-plants";
import type { QuizPlant } from "./types";

function plant(id: string): QuizPlant {
  return {
    id,
    scientificName: id,
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
  };
}

// A deterministic stand-in for Math.random so tests aren't flaky.
function sequenceRandom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("weightedSampleWithoutReplacement", () => {
  it("never returns more items than requested or available, and never duplicates", () => {
    const items = ["a", "b", "c"].map((id) => ({ item: id, weight: 1 }));
    const result = weightedSampleWithoutReplacement(items, 2, Math.random);
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);

    const overRequested = weightedSampleWithoutReplacement(items, 10, Math.random);
    expect(overRequested).toHaveLength(3);
  });

  it("is deterministic given a deterministic random source", () => {
    const items = [
      { item: "a", weight: 1 },
      { item: "b", weight: 1 },
      { item: "c", weight: 1 },
    ];
    // Fixed "random" draws -> fixed keys -> fixed ranking, regardless of
    // weight ties, so the result is exactly reproducible.
    const random = sequenceRandom([0.9, 0.1, 0.5]);
    expect(weightedSampleWithoutReplacement(items, 3, random)).toEqual(["a", "c", "b"]);
  });

  it("heavily favours a high-weight item over many trials, but never excludes a low-weight one entirely", () => {
    const items = [
      { item: "heavy", weight: 50 },
      { item: "light", weight: 0.05 },
    ];
    // why 20000, not a smaller round number: at this weight ratio "light"
    // wins any single draw roughly 1 time in 1000, so 2000 trials (the
    // original count) has a real ~13% chance of never picking it even
    // though the algorithm is working correctly — caught by an actual CI
    // run flaking, not by local testing (Math.random varies run to run).
    // 20000 trials pushes that false-failure rate to effectively zero
    // (~1e-9) while still finishing in well under a second.
    const trials = 20000;
    let heavyPickedFirst = 0;
    let lightEverPicked = 0;
    for (let i = 0; i < trials; i++) {
      const [first] = weightedSampleWithoutReplacement(items, 1, Math.random);
      if (first === "heavy") heavyPickedFirst++;
      if (first === "light") lightEverPicked++;
    }
    // why generous thresholds, not exact ratios: this is a real statistical
    // test using Math.random, not a mocked one — it needs headroom to avoid
    // flaking while still meaningfully asserting the direction of the bias
    // (this is the actual property the whole prioritisation feature depends
    // on: wrong answers should surface much more than mastered ones).
    expect(heavyPickedFirst).toBeGreaterThan(trials * 0.9);
    expect(lightEverPicked).toBeGreaterThan(0);
  });
});

describe("selectQuizPlants", () => {
  it("defaults to weight 1 for a plant with no plant_stats row", () => {
    const plants = [plant("p1"), plant("p2")];
    const weights = new Map([["p1", 1]]); // p2 has no entry at all
    const result = selectQuizPlants(plants, weights, 2, Math.random);
    expect(result.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("respects the requested question count exactly when enough plants exist", () => {
    const plants = Array.from({ length: 10 }, (_, i) => plant(`p${i}`));
    const result = selectQuizPlants(plants, new Map(), 4, Math.random);
    expect(result).toHaveLength(4);
    expect(new Set(result.map((p) => p.id)).size).toBe(4);
  });
});
