import {
  canShowLatinShortcut,
  deleteYouTubeAnswerLetter,
  insertYouTubeAnswerText,
  normalizeLatinShortcutKey,
  normalizeYouTubeAnswerText,
} from "../../playable/input";

describe("YouTube native answer input", () => {
  it("normalizes native IME text into NFC graphemes and rejects punctuation", () => {
    expect(normalizeYouTubeAnswerText("e\u0301!猫", "fr")).toEqual(["é", "猫"]);
    expect(normalizeYouTubeAnswerText("नदी", "hi")).toEqual(["न", "दी"]);
  });

  it("inserts committed text without replacing locked hints", () => {
    /** Updates d. */
    const updated = insertYouTubeAnswerText({letters: ["", "月", ""], activeSlotIndex: 0}, "猫犬", 3, [1], "ja");
    expect(updated.letters[1]).toBe("月");
    expect(updated.letters.filter(Boolean)).toHaveLength(3);
  });

  it("deletes only editable slots and limits QWERTY to Latin answers", () => {
    expect(deleteYouTubeAnswerLetter({letters: ["a", "b", "c"], activeSlotIndex: 1}, 3, [1])).toEqual({
      letters: ["", "b", "c"],
      activeSlotIndex: 0,
    });
    expect(canShowLatinShortcut("Rome")).toBe(true);
    expect(canShowLatinShortcut("ſ")).toBe(false);
    expect(canShowLatinShortcut("東京")).toBe(false);
    expect(normalizeLatinShortcutKey("I")).toBe("i");
    expect(normalizeLatinShortcutKey("İ")).toBe("");
  });
});
