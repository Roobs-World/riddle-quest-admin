import {describe, expect, it} from "@jest/globals";
import {graphemeLength, iterateGraphemes, lowerCaseGraphemes, splitGraphemes} from "../graphemes";

describe("grapheme helpers", () => {
  it("iterates normalized Unicode clusters and supports stopping at a bounded prefix", () => {
    /** A consumer can retain two complete graphemes without enumerating the suffix. */
    const iterator = iterateGraphemes("e\u0301👩🏽‍🚀नदी", "hi");
    expect(iterator.next().value).toBe("é");
    expect(iterator.next().value).toBe("👩🏽‍🚀");
    expect(iterator.return?.()).toEqual({value: undefined, done: true});
    expect(iterator.next().done).toBe(true);
    expect([...iterateGraphemes("नदी", "hi")]).toEqual(["न", "दी"]);
    expect([...iterateGraphemes("")]).toEqual([]);
  });

  it("validates a nonempty iterator locale when consumed, and keeps empty input harmless", () => {
    /** Creating an iterator does not perform text work before its consumer requests a value. */
    const iterator = iterateGraphemes("a", "not_a_locale");
    expect(() => iterator.next()).toThrow(RangeError);
    expect([...iterateGraphemes("", "not_a_locale")]).toEqual([]);
  });

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
    /** Provides original segmenter behavior. */
    const originalSegmenter = Intl.Segmenter;
    Object.defineProperty(Intl, "Segmenter", {configurable: true, value: undefined});
    jest.isolateModules(() => {
      /** Provides fallback behavior. */
      const fallback = jest.requireActual("../graphemes") as typeof import("../graphemes");
      expect(fallback.splitGraphemes("A😀")).toEqual(["A", "😀"]);
      expect([...fallback.iterateGraphemes("A😀")]).toEqual(["A", "😀"]);
    });
    Object.defineProperty(Intl, "Segmenter", {configurable: true, value: originalSegmenter});
  });
});
