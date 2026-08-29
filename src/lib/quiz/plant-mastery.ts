const FLOOR_WEIGHT = 0.1;
const MAX_WEIGHT = 10;
const INCORRECT_MULTIPLIER = 2;
const CORRECT_DECAY = 0.6;

// why exponential (not additive) growth/decay: a plant missed twice in a
// row should surface far more aggressively than one missed once — a flat
// "+1 / -1" would treat a plant the user has never learned the same as one
// they slipped on once. The floor/cap keep it bounded: a mastered plant
// never becomes literally unselectable (see SPEC-010's "never fully
// retired" requirement), and one very-wrong plant never dominates every
// future quiz absolutely.
export function computeNextWeight(currentWeight: number, correct: boolean): number {
  if (correct) return Math.max(currentWeight * CORRECT_DECAY, FLOOR_WEIGHT);
  return Math.min(currentWeight * INCORRECT_MULTIPLIER, MAX_WEIGHT);
}
