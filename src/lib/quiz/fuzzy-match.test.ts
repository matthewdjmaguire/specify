import { describe, expect, it } from "vitest";
import { isCloseEnough } from "./fuzzy-match";

describe("isCloseEnough", () => {
  it("accepts an exact match, case-insensitively", () => {
    expect(isCloseEnough("Acer palmatum", "Acer palmatum")).toBe(true);
    expect(isCloseEnough("acer PALMATUM", "Acer palmatum")).toBe(true);
  });

  it("forgives a single missing letter", () => {
    expect(isCloseEnough("Acer palmatm", "Acer palmatum")).toBe(true);
  });

  it("forgives a wrong ending", () => {
    expect(isCloseEnough("Acer palmata", "Acer palmatum")).toBe(true);
  });

  it("forgives an adjacent-letter transposition, including on a short name", () => {
    expect(isCloseEnough("Acer plamatum", "Acer palmatum")).toBe(true);
    expect(isCloseEnough("Irsi", "Iris")).toBe(true);
  });

  it("rejects a genuinely different plant name of similar length", () => {
    expect(isCloseEnough("Betula pendula", "Acer palmatum")).toBe(false);
    expect(isCloseEnough("Quercus robur", "Acer palmatum")).toBe(false);
  });

  it("rejects an empty or whitespace-only answer", () => {
    expect(isCloseEnough("", "Acer palmatum")).toBe(false);
    expect(isCloseEnough("   ", "Acer palmatum")).toBe(false);
  });

  it("ignores RHS's bracketed disambiguation suffix", () => {
    expect(isCloseEnough("Acer palmatum", "Acer palmatum [1]")).toBe(true);
  });

  it("ignores cultivar quote marks and punctuation differences", () => {
    expect(isCloseEnough("Acer palmatum bloodgood", "Acer palmatum 'Bloodgood'")).toBe(true);
  });

  it("does not over-forgive on very short names — a real one-letter-different word still fails if it's too different relative to length", () => {
    // "Rosa" vs "Iris": both 4 letters but share no meaningful overlap.
    expect(isCloseEnough("Rosa", "Iris")).toBe(false);
  });
});
