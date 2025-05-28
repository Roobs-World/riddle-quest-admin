import {
  containsProfanity,
  validateUsernameForProfanity,
} from "../profanityFilter";

describe("profanityFilter", () => {
  describe("containsProfanity", () => {
    it("should return true for usernames containing profanity", () => {
      expect(containsProfanity("fuck")).toBe(true);
      expect(containsProfanity("badass")).toBe(true);
      expect(containsProfanity("hellboy")).toBe(true);
      expect(containsProfanity("FuckYou")).toBe(true);
      expect(containsProfanity("XXXuser")).toBe(true);
    });

    it("should return false for clean usernames", () => {
      expect(containsProfanity("johndoe")).toBe(false);
      expect(containsProfanity("gamer123")).toBe(false);
      expect(containsProfanity("cooluser")).toBe(false);
      expect(containsProfanity("player1")).toBe(false);
      expect(containsProfanity("awesome")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(containsProfanity("")).toBe(false);
      expect(containsProfanity(" ")).toBe(false);
      expect(containsProfanity(null as unknown as string)).toBe(false);
      expect(containsProfanity(undefined as unknown as string)).toBe(false);
      expect(containsProfanity(123 as unknown as string)).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(containsProfanity("FUCK")).toBe(true);
      expect(containsProfanity("FuCk")).toBe(true);
      expect(containsProfanity("fUcK")).toBe(true);
    });
  });

  describe("validateUsernameForProfanity", () => {
    it("should return error message for profane usernames", () => {
      const result = validateUsernameForProfanity("badword");
      expect(result).toBe(
        "Username contains inappropriate language. Please choose a different username."
      );
    });

    it("should return empty string for clean usernames", () => {
      const result = validateUsernameForProfanity("cleanuser");
      expect(result).toBe("");
    });
  });
});
