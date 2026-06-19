import {computeFeedback} from "../computeFeedback";

describe("computeFeedback", () => {
  it("returns all green for an exact match", () => {
    expect(computeFeedback("hello", "hello")).toEqual(["green", "green", "green", "green", "green"]);
  });

  it("is case-insensitive", () => {
    expect(computeFeedback("HELLO", "hello")).toEqual(["green", "green", "green", "green", "green"]);
    expect(computeFeedback("world", "WORLD")).toEqual(["green", "green", "green", "green", "green"]);
  });

  it("marks all yellow when letters are present but misplaced", () => {
    expect(computeFeedback("olehl", "hello")).toEqual(["yellow", "yellow", "yellow", "yellow", "yellow"]);
  });

  it("handles duplicate letters — excess duplicates are red", () => {
    expect(computeFeedback("lllll", "hello")).toEqual(["red", "red", "green", "green", "red"]);
  });

  it("marks green before yellow to prevent double counting", () => {
    expect(computeFeedback("babes", "abbey")).toEqual(["yellow", "yellow", "green", "green", "red"]);
  });

  it("treats composed characters as a single grapheme", () => {
    expect(computeFeedback("e\u0301", "é")).toEqual(["green"]);
  });
});
