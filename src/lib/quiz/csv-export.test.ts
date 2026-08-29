import { describe, expect, it } from "vitest";
import { generateQuizHistoryCsv, type AttemptExportRow } from "./csv-export";

function row(overrides: Partial<AttemptExportRow> = {}): AttemptExportRow {
  return {
    themeName: "Trees",
    mode: "hard",
    startedAt: "2026-08-01T10:00:00.000Z",
    completedAt: "2026-08-01T10:15:00.000Z",
    correctCount: 8,
    totalQuestions: 10,
    ...overrides,
  };
}

describe("generateQuizHistoryCsv", () => {
  it("writes a header row followed by one row per attempt", () => {
    const csv = generateQuizHistoryCsv([row(), row({ themeName: "Shrubs", correctCount: 3, totalQuestions: 5 })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Theme,Mode,Date,Score");
    expect(lines[1]).toBe("Trees,hard,2026-08-01T10:15:00.000Z,8/10");
    expect(lines[2]).toBe("Shrubs,hard,2026-08-01T10:15:00.000Z,3/5");
  });

  it("falls back to startedAt when an attempt was never completed", () => {
    const csv = generateQuizHistoryCsv([row({ completedAt: null, startedAt: "2026-08-01T10:00:00.000Z" })]);
    expect(csv.split("\r\n")[1]).toContain("2026-08-01T10:00:00.000Z");
  });

  it("quotes and escapes theme names containing a comma", () => {
    const csv = generateQuizHistoryCsv([row({ themeName: 'UK Hanging Baskets, "Shade"' })]);
    expect(csv.split("\r\n")[1].startsWith('"UK Hanging Baskets, ""Shade"""')).toBe(true);
  });

  it("returns just the header for no attempts", () => {
    expect(generateQuizHistoryCsv([])).toBe("Theme,Mode,Date,Score");
  });
});
