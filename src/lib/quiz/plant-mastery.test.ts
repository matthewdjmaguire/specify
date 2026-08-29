import { describe, expect, it } from "vitest";
import { computeNextWeight } from "./plant-mastery";

describe("computeNextWeight", () => {
  it("decreases weight on a correct answer", () => {
    expect(computeNextWeight(1, true)).toBeCloseTo(0.6);
  });

  it("increases weight on an incorrect answer", () => {
    expect(computeNextWeight(1, false)).toBe(2);
  });

  it("floors weight at 0.1 after many consecutive correct answers, never reaching zero", () => {
    let weight = 1;
    for (let i = 0; i < 50; i++) weight = computeNextWeight(weight, true);
    expect(weight).toBeCloseTo(0.1);
    expect(weight).toBeGreaterThan(0);
  });

  it("caps weight at 10 after many consecutive incorrect answers", () => {
    let weight = 1;
    for (let i = 0; i < 50; i++) weight = computeNextWeight(weight, false);
    expect(weight).toBe(10);
  });

  it("a single correct answer recovers some weight after a miss, without fully resetting it", () => {
    const afterMiss = computeNextWeight(1, false); // 2
    const afterRecovery = computeNextWeight(afterMiss, true); // 1.2
    expect(afterRecovery).toBeGreaterThan(1); // still higher than the original baseline of 1
    expect(afterRecovery).toBeLessThan(afterMiss); // but lower than right after the miss
  });
});
