import type { QuizPlant } from "./types";
import { pickRandom } from "./random-utils";

// why family first, then habit, then anything: a distractor from the same
// family (e.g. another Acer) is a genuinely plausible wrong answer for a
// learner; same habit alone (e.g. "another tree") is a weaker but still
// reasonable fallback; random-from-everything only kicks in when a theme's
// pool is too small/narrow to offer better candidates — this never fails to
// return options, it just returns weaker ones.
export function selectDistractors(
  correct: QuizPlant,
  pool: QuizPlant[],
  count = 3,
  random: () => number = Math.random,
): QuizPlant[] {
  const candidates = pool.filter((p) => p.id !== correct.id);
  const chosen: QuizPlant[] = [];
  const usedIds = new Set<string>();

  function takeFrom(source: QuizPlant[]) {
    if (chosen.length >= count) return;
    const remaining = source.filter((p) => !usedIds.has(p.id));
    const picked = pickRandom(remaining, count - chosen.length, random);
    for (const p of picked) {
      chosen.push(p);
      usedIds.add(p.id);
    }
  }

  if (correct.family) takeFrom(candidates.filter((p) => p.family === correct.family));
  if (correct.habit) takeFrom(candidates.filter((p) => p.habit === correct.habit));
  takeFrom(candidates);

  return chosen;
}
