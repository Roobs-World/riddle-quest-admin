import {containsProfanity, validateUsernameForProfanity} from "../profanity";

describe("username profanity validation", () => {
  it.each(["", "PuzzleMaster", "Titanium", "analysis"])('accepts "%s"', (username) => {
    expect(containsProfanity(username)).toBe(false);
    expect(validateUsernameForProfanity(username)).toBe("");
  });

  it("matches case-insensitive words and non-boundary substrings", () => {
    expect(containsProfanity("  FUCK  ")).toBe(true);
    expect(containsProfanity("prefixshitpostfix")).toBe(true);
    expect(validateUsernameForProfanity("shit")).toMatch(/inappropriate language/i);
  });

  it("requires word boundaries for ambiguous short words", () => {
    expect(containsProfanity("tit")).toBe(true);
    expect(containsProfanity("titanium")).toBe(false);
  });

  it("fails safely for a non-string runtime value", () => {
    expect(containsProfanity(null as unknown as string)).toBe(false);
  });
});
