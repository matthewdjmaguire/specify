import { describe, expect, it } from "vitest";
import { dailyIndex } from "./daily-hero";

describe("dailyIndex", () => {
  it("is deterministic for the same date and count", () => {
    const date = new Date("2026-08-31T14:00:00Z");
    expect(dailyIndex(date, 268)).toBe(dailyIndex(date, 268));
  });

  it("is the same for any time of day, not just midnight", () => {
    expect(dailyIndex(new Date("2026-08-31T00:00:01Z"), 268)).toBe(dailyIndex(new Date("2026-08-31T23:59:59Z"), 268));
  });

  it("changes on a different date (not guaranteed every time, but true for these two)", () => {
    const today = dailyIndex(new Date("2026-08-31T12:00:00Z"), 268);
    const tomorrow = dailyIndex(new Date("2026-09-01T12:00:00Z"), 268);
    expect(today).not.toBe(tomorrow);
  });

  it("always returns an index within [0, count)", () => {
    for (let day = 1; day <= 28; day++) {
      const date = new Date(Date.UTC(2026, 0, day));
      const index = dailyIndex(date, 268);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(268);
    }
  });

  it("returns 0 for a non-positive count instead of dividing by zero", () => {
    expect(dailyIndex(new Date(), 0)).toBe(0);
  });
});
