import {clueContainsLiteralAnswer} from "../riddles/riddleQuality";

describe("riddle clue quality", () => {
  it.each([
    ["What falls as rain but never rises?", "rain", true],
    ["Rain", "rain", true],
    ["What has keys but opens no locks?", "piano", false],
    ["", "answer", false],
    ["Question", "", false],
    ["Symbols: café!", "CAFÉ", true],
  ])("compares normalized clue and answer text", (question, answer, expected) => {
    expect(clueContainsLiteralAnswer(question, answer)).toBe(expected);
  });
});
