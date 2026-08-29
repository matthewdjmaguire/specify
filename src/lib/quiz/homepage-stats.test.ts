import { describe, expect, it } from "vitest";
import { mostCommonCategories, weeklyAccuracyTrend, type DatedNameQuestionRecord } from "./homepage-stats";
import type { NameQuestionRecord } from "./summarize-attempt";

function q(status: NameQuestionRecord["status"], habit: string | null, family: string | null = null): NameQuestionRecord {
  return { status, plant: { habit, family } };
}

function dq(
  status: NameQuestionRecord["status"],
  habit: string | null,
  daysAgo: number,
  now: Date,
): DatedNameQuestionRecord {
  return { status, plant: { habit, family: null }, createdAt: new Date(now.getTime() - daysAgo * 86400000).toISOString() };
}

describe("mostCommonCategories", () => {
  it("sorts by volume, ignoring categoryless plants, capped at the given limit", () => {
    const records = [
      q("correct", "Tree"),
      q("correct", "Tree"),
      q("incorrect", "Tree"),
      q("correct", "Shrub"),
      q("correct", null, null), // no category — excluded
      q("incorrect", "Climber"),
    ];
    expect(mostCommonCategories(records, 2)).toEqual([
      { category: "Tree", total: 3 },
      { category: "Shrub", total: 1 },
    ]);
  });

  it("returns an empty list for no records", () => {
    expect(mostCommonCategories([])).toEqual([]);
  });
});

describe("weeklyAccuracyTrend", () => {
  const now = new Date("2026-08-29T12:00:00Z");

  it("returns null when either period has fewer than 3 questions", () => {
    const records = [dq("correct", "Tree", 1, now), dq("correct", "Tree", 8, now), dq("correct", "Tree", 9, now)];
    expect(weeklyAccuracyTrend(records, now)).toBeNull();
  });

  it("reports 'up' when this week's accuracy beats last week's", () => {
    const records = [
      dq("correct", "Tree", 1, now),
      dq("correct", "Tree", 2, now),
      dq("correct", "Tree", 3, now),
      dq("incorrect", "Tree", 8, now),
      dq("incorrect", "Tree", 9, now),
      dq("correct", "Tree", 10, now),
    ];
    const trend = weeklyAccuracyTrend(records, now);
    expect(trend).toEqual({ direction: "up", currentAccuracyPercent: 100, previousAccuracyPercent: 33 });
  });

  it("reports 'down' when this week's accuracy is worse than last week's", () => {
    const records = [
      dq("incorrect", "Tree", 1, now),
      dq("incorrect", "Tree", 2, now),
      dq("correct", "Tree", 3, now),
      dq("correct", "Tree", 8, now),
      dq("correct", "Tree", 9, now),
      dq("correct", "Tree", 10, now),
    ];
    expect(weeklyAccuracyTrend(records, now)?.direction).toBe("down");
  });

  it("ignores questions older than the two-week comparison window", () => {
    const records = [
      dq("correct", "Tree", 1, now),
      dq("correct", "Tree", 2, now),
      dq("correct", "Tree", 3, now),
      dq("correct", "Tree", 8, now),
      dq("correct", "Tree", 9, now),
      dq("correct", "Tree", 10, now),
      dq("incorrect", "Tree", 30, now), // outside the window — must not affect the result
    ];
    expect(weeklyAccuracyTrend(records, now)).toEqual({
      direction: "flat",
      currentAccuracyPercent: 100,
      previousAccuracyPercent: 100,
    });
  });
});
