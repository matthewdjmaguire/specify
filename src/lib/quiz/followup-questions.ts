import type { QuizPlant } from "./types";
import { pickRandom, shuffle } from "./random-utils";

export const FOLLOWUP_CATEGORIES = ["soil", "hardiness", "position", "height", "spread"] as const;
export type FollowupCategory = (typeof FOLLOWUP_CATEGORIES)[number];

export const FOLLOWUP_CATEGORY_LABELS: Record<FollowupCategory, string> = {
  soil: "Soil Type",
  hardiness: "Hardiness",
  position: "Position",
  height: "Max Height",
  spread: "Max Spread",
};

export function followupCategoryValue(plant: QuizPlant, category: FollowupCategory): string | null {
  switch (category) {
    case "soil":
      return plant.soilTypes.length > 0 ? plant.soilTypes.join(", ") : null;
    case "hardiness":
      return plant.hardiness;
    case "position":
      return plant.position.length > 0 ? plant.position.join(", ") : null;
    case "height":
      return plant.heightRange;
    case "spread":
      return plant.spreadRange;
  }
}

// why filtered to populated fields, not just the first N categories: asking
// about a characteristic the plant's own record has no data for would be an
// unanswerable question — see the ticket's explicit requirement to skip
// rather than guess.
export function selectFollowupCategories(
  plant: QuizPlant,
  count: number,
  random: () => number = Math.random,
): FollowupCategory[] {
  const available = FOLLOWUP_CATEGORIES.filter((c) => followupCategoryValue(plant, c) !== null);
  return pickRandom(available, count, random);
}

export type FollowupQuestionView = {
  category: FollowupCategory;
  label: string;
  correctValue: string;
  options: string[];
};

// why distractors come from other real plants' values, not invented ones:
// same reasoning as selectDistractors (SPEC-012) — a real RHS-authored
// height range or hardiness rating is automatically plausible, and this
// needs no per-category "what's a fake-but-believable value" logic.
export function buildFollowupQuestion(
  plant: QuizPlant,
  category: FollowupCategory,
  pool: QuizPlant[],
  random: () => number = Math.random,
): FollowupQuestionView | null {
  const correctValue = followupCategoryValue(plant, category);
  if (!correctValue) return null;

  const distinctOtherValues = [
    ...new Set(
      pool
        .map((p) => followupCategoryValue(p, category))
        .filter((v): v is string => v !== null && v !== correctValue),
    ),
  ];
  const distractors = pickRandom(distinctOtherValues, 3, random);

  return {
    category,
    label: FOLLOWUP_CATEGORY_LABELS[category],
    correctValue,
    options: shuffle([correctValue, ...distractors], random),
  };
}
