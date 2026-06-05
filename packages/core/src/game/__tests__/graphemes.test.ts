import {describe, expect, it} from "@jest/globals";
import {graphemeLength, splitGraphemes} from "../graphemes";

describe("grapheme helpers", () => {
  it("counts composed characters as one grapheme", () => {
    expect(graphemeLength("e\u0301")).toBe(1);
    expect(splitGraphemes("e\u0301")).toEqual(["é"]);
  });

  it("splits emoji sequences without breaking joined glyphs", () => {
    expect(graphemeLength("👩🏽‍🚀")).toBe(1);
    expect(splitGraphemes("👩🏽‍🚀")).toEqual(["👩🏽‍🚀"]);
  });
});
