import { categoryFor, type NameQuestionRecord } from "./summarize-attempt";

export type DatedNameQuestionRecord = NameQuestionRecord & { createdAt: string };

export type CategoryVolume = { category: string; total: number };

export function mostCommonCategories(records: NameQuestionRecord[], limit = 3): CategoryVolume[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const category = categoryFor(r.plant);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, total]) => ({ category, total }));
}

export type AccuracyTrend = {
  direction: "up" | "down" | "flat";
  currentAccuracyPercent: number;
  previousAccuracyPercent: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_TREND_SAMPLE = 3;

function accuracyPercent(records: NameQuestionRecord[]): number {
  return Math.round((records.filter((r) => r.status === "correct").length / records.length) * 100);
}

// why two full weeks of history required, not "since account creation": a
// trend needs something to compare against — one lone week of data has no
// prior period, so it's noise dressed up as a trend rather than a real one.
export function weeklyAccuracyTrend(
  records: DatedNameQuestionRecord[],
  now: Date = new Date(),
): AccuracyTrend | null {
  const weekStart = new Date(now.getTime() - WEEK_MS);
  const twoWeeksStart = new Date(now.getTime() - 2 * WEEK_MS);

  const current = records.filter((r) => new Date(r.createdAt) >= weekStart);
  const previous = records.filter((r) => {
    const t = new Date(r.createdAt);
    return t >= twoWeeksStart && t < weekStart;
  });

  if (current.length < MIN_TREND_SAMPLE || previous.length < MIN_TREND_SAMPLE) return null;

  const currentAccuracyPercent = accuracyPercent(current);
  const previousAccuracyPercent = accuracyPercent(previous);
  const direction =
    currentAccuracyPercent > previousAccuracyPercent
      ? "up"
      : currentAccuracyPercent < previousAccuracyPercent
        ? "down"
        : "flat";

  return { direction, currentAccuracyPercent, previousAccuracyPercent };
}
