export type CategoryStat = {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
};

export type AttemptSummary = {
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
  strengths: CategoryStat[];
  focusAreas: CategoryStat[];
};

export type NameQuestionRecord = {
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  plant: { habit: string | null; family: string | null };
};

const MIN_SAMPLE_SIZE = 2;
const STRENGTH_THRESHOLD = 0.75;

// why habit first, falling back to family: habit values ("Tree", "Bushy",
// "Climbing") read as plain-English plant *types* — closer to how a garden
// designer actually talks about strengths/weaknesses ("I'm solid on trees,
// weak on climbers") than a Latin family name. Family is still a reasonable
// fallback for the plants that have no habit recorded.
export function categoryFor(plant: { habit: string | null; family: string | null }): string | null {
  return plant.habit ?? plant.family ?? null;
}

// why only 'name' questions feed this (see call site): strengths/focus
// areas are about plant *recognition*, the same skill SPEC-010/017's
// prioritisation is about — follow-up characteristic answers are a
// different skill and would muddy a "which plant types do you know" signal.
export function summarizeAttempt(nameQuestions: NameQuestionRecord[]): AttemptSummary {
  const totalQuestions = nameQuestions.length;
  const correctCount = nameQuestions.filter((q) => q.status === "correct").length;
  const accuracyPercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const q of nameQuestions) {
    const category = categoryFor(q.plant);
    if (!category) continue;
    const entry = byCategory.get(category) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (q.status === "correct") entry.correct += 1;
    byCategory.set(category, entry);
  }

  // why a minimum sample size: a single question in "Ericaceae" going
  // wrong shouldn't label the whole family a "focus area" — that's noise,
  // not a pattern. Categories with too few questions in this attempt are
  // left out of both lists entirely rather than guessed at.
  const stats: CategoryStat[] = [...byCategory.entries()]
    .filter(([, v]) => v.total >= MIN_SAMPLE_SIZE)
    .map(([category, v]) => ({
      category,
      correct: v.correct,
      total: v.total,
      accuracy: v.correct / v.total,
    }));

  const strengths = stats
    .filter((s) => s.accuracy >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
  const focusAreas = stats
    .filter((s) => s.accuracy < STRENGTH_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  return { totalQuestions, correctCount, accuracyPercent, strengths, focusAreas };
}
