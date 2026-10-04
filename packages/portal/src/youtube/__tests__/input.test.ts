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

  it.each([
    {letters: ["", "", "", ""], activeSlotIndex: 0, text: "romeEXTRAS", locked: [], locale: "en", expected: ["r", "o", "m", "e"]},
    {letters: ["r", "o", "m", "x"], activeSlotIndex: 3, text: "eEXTRAS", locked: [], locale: "en", expected: ["r", "o", "m", "e"]},
    {letters: ["", "月", "", ""], activeSlotIndex: 0, text: "猫犬鳥追加", locked: [1], locale: "ja", expected: ["猫", "月", "犬", "鳥"]},
  ])("preserves the bounded prefix of one committed text unit: $text", ({letters, activeSlotIndex, text, locked, locale, expected}) => {
    expect(insertYouTubeAnswerText({letters, activeSlotIndex}, text, 4, locked, locale).letters).toEqual(expected);
  });

  it("skips rejected input before a Unicode prefix while preserving hint locks and the original draft", () => {
    /** Existing hint is immutable while a new committed text unit fills the other slots. */
    const draft = {letters: ["", "月", "", ""], activeSlotIndex: 0};
    expect(insertYouTubeAnswerText(draft, "!? e\u0301猫犬鳥" + "x".repeat(20000), 4, [1], "ja").letters)
      .toEqual(["é", "月", "猫", "犬"]);
    expect(draft.letters).toEqual(["", "月", "", ""]);
    expect(insertYouTubeAnswerText(draft, "!? 123", 4, [1], "ja")).toBe(draft);
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
