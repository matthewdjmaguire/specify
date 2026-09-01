import type { QuizPlant } from "./types";

// why the Efraimidis-Spirakis algorithm (key = random()^(1/weight), keep the
// top-N keys): the standard way to do weighted sampling *without*
// replacement in one pass — naive "pick weighted, remove, repeat" works too
// but is O(n^2)-ish and fiddlier to get right. This also naturally produces
// a random final order (no separate shuffle step needed), which is the
// ticket's "randomised order per attempt" requirement for free.
export function weightedSampleWithoutReplacement<T>(
  items: Array<{ item: T; weight: number }>,
  count: number,
  random: () => number = Math.random,
): T[] {
  const keyed = items.map(({ item, weight }) => ({
    item,
    // why Math.max(weight, floor): weight <= 0 makes 1/weight infinite/NaN —
    // a tiny positive floor keeps every item sampleable (see the module doc
    // below on "never fully retired") without ever dividing by zero.
    key: Math.pow(random(), 1 / Math.max(weight, 0.0001)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, Math.min(count, keyed.length)).map((k) => k.item);
}

export type PlantSelectionMode = "priority" | "random";

// why plant_stats.priority_weight (not computed here): SPEC-017 owns
// *writing* the weight (raise after a miss, decay after repeated correct
// answers, with its own floor) — this module only ever reads it and turns it
// into a selection. A plant with no plant_stats row yet (never quizzed)
// defaults to weight 1, same as a freshly-reset plant.
//
// why a mode flag rather than a second function: "random" mode is just
// "priority" mode with every weight forced to 1 — reusing
// weightedSampleWithoutReplacement for both keeps the randomised-order
// guarantee (see its own doc comment) instead of duplicating a plain
// Fisher-Yates shuffle here.
export function selectQuizPlants(
  plants: QuizPlant[],
  weightsByPlantId: Map<string, number>,
  questionCount: number,
  random: () => number = Math.random,
  mode: PlantSelectionMode = "priority",
): QuizPlant[] {
  const weighted = plants.map((plant) => ({
    item: plant,
    weight: mode === "random" ? 1 : (weightsByPlantId.get(plant.id) ?? 1),
  }));
  return weightedSampleWithoutReplacement(weighted, questionCount, random);
}
