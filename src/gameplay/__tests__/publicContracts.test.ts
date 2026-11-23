import {isSinglePlayerKeyboardLetter} from "../input/singlePlayerKeyboard";
import {iterateGraphemes} from "../input/graphemes";

describe("shared input contracts", () => {
  it("filters keyboard input through the shared game rules", () => {
    for (const letter of ["i", "I", "İ", "ı"]) {
      expect(isSinglePlayerKeyboardLetter(letter)).toBe(true);
    }
    for (const input of ["Enter", "Backspace", "ii", "", null]) {
      expect(isSinglePlayerKeyboardLetter(input)).toBe(false);
    }
  });

  it("normalizes Unicode graphemes", () => {
    expect([...iterateGraphemes("a\u0301👩‍🚀")]).toEqual(["á", "👩‍🚀"]);
  });
});
