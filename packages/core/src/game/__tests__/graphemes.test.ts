import {describe, expect, it} from "@jest/globals";
import {graphemeLength, lowerCaseGraphemes, splitGraphemes} from "../graphemes";

describe("grapheme helpers", () => {
  it("counts composed characters as one grapheme", () => {
    expect(graphemeLength("e\u0301")).toBe(1);
    expect(splitGraphemes("e\u0301")).toEqual(["é"]);
  });

  it("splits emoji sequences without breaking joined glyphs", () => {
    expect(graphemeLength("👩🏽‍🚀")).toBe(1);
    expect(splitGraphemes("👩🏽‍🚀")).toEqual(["👩🏽‍🚀"]);
  });

  it("handles empty input, locale-aware casing, and cached segmenters", () => {
    expect(splitGraphemes("")).toEqual([]);
    expect(lowerCaseGraphemes("İ", "tr")).toEqual(["i"]);
    expect(splitGraphemes("ab", "tr")).toEqual(["a", "b"]);
    expect(splitGraphemes("ab", "")).toEqual(["a", "b"]);
  });

  it("falls back to code points when Intl.Segmenter is unavailable", () => {
    const originalSegmenter = Intl.Segmenter;
    Object.defineProperty(Intl, "Segmenter", {configurable: true, value: undefined});
    jest.isolateModules(() => {
      const fallback = jest.requireActual("../graphemes") as typeof import("../graphemes");
      expect(fallback.splitGraphemes("A😀")).toEqual(["A", "😀"]);
    });
    Object.defineProperty(Intl, "Segmenter", {configurable: true, value: originalSegmenter});
  });
});
