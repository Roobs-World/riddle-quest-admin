import {
  findNextEditableGuessSlot,
  findPreviousEditableGuessSlot,
  resolveBackspaceGuessSlot,
  resolveEditableGuessSlot,
  resolveNextActiveGuessSlot,
} from "../guessSlots";

describe("guess slot helpers", () => {
  it("finds the next editable slot after locked hint slots", () => {
    expect(findNextEditableGuessSlot(0, 5, [0, 2])).toBe(1);
    expect(findNextEditableGuessSlot(2, 5, [0, 2])).toBe(3);
  });

  it("finds the previous editable slot before locked hint slots", () => {
    expect(findPreviousEditableGuessSlot(3, [1, 3])).toBe(2);
    expect(findPreviousEditableGuessSlot(1, [0, 1])).toBeNull();
  });

  it("resolves a locked requested slot to the nearest editable slot", () => {
    expect(resolveEditableGuessSlot(0, 5, [0])).toBe(1);
    expect(resolveEditableGuessSlot(4, 5, [4])).toBe(3);
  });

  it("returns null when every slot is locked", () => {
    expect(resolveEditableGuessSlot(2, 3, [0, 1, 2])).toBeNull();
  });

  it("skips locked slots when advancing after letter entry", () => {
    expect(resolveNextActiveGuessSlot(0, 5, [1, 2])).toBe(3);
    expect(resolveNextActiveGuessSlot(3, 5, [4])).toBe(3);
  });

  it("never targets locked hint slots for backspace", () => {
    expect(resolveBackspaceGuessSlot(2, ["a", "b", "c"], 3, [2])).toBe(1);
    expect(resolveBackspaceGuessSlot(1, ["a", "b", "c"], 3, [0, 1])).toBeNull();
  });
});
