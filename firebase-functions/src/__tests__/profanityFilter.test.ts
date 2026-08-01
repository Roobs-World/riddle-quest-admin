import {describe, expect, test} from "@jest/globals";

// Import the functions to test
import {containsProfanity, validateUsernameForProfanity} from "../utils/profanityFilter";

describe("Profanity Filter", () => {
  describe("containsProfanity", () => {
    test("should return false for clean usernames", () => {
      const cleanUsernames = [
        "username123",
        "goodUser",
        "player1",
        "awesomeGamer",
        "coolDude",
        "testUser",
        "validName",
        "normalPlayer",
      ];

      cleanUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(false);
      });
    });

    test("should return true for usernames containing profanity", () => {
      const profaneUsernames = [
        "fuck123",
        "shittyUser",
        "bitchPlayer",
        "cunt",
        "asshole_gamer",
        "hellBoy",
        "crapUser",
        "damn_it",
        "pissed_off",
      ];

      profaneUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should detect profanity with different cases", () => {
      const caseVariations = ["FUCK", "Shit", "BiTcH", "CunT", "aSsHoLe", "DAMN", "Hell", "CrAp", "PiSs"];

      caseVariations.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should detect profanity as exact word matches", () => {
      const exactMatches = ["kill", "die", "rape", "murder", "nazi", "hitler", "suicide"];

      exactMatches.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should detect profanity as substring matches", () => {
      const substringMatches = [
        "fucking_awesome",
        "shittygamer",
        "bitchmode",
        "assholeking",
        "damngood",
        "hellish",
        "crapload",
        "pissant",
      ];

      substringMatches.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should detect drug-related terms", () => {
      const drugTerms = ["cocaine", "heroin", "meth", "weed", "marijuana", "drugs", "cocainelover", "weedmaster"];

      drugTerms.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should detect adult content terms", () => {
      const adultTerms = [
        "porn",
        "sex",
        "xxx",
        "adult",
        "nude",
        "naked",
        "strip",
        "escort",
        "prostitute",
        "pornstar",
        "sexygamer",
      ];

      adultTerms.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should handle edge cases", () => {
      // Empty string
      expect(containsProfanity("")).toBe(false);

      // Null/undefined
      expect(containsProfanity(null as any)).toBe(false);
      expect(containsProfanity(undefined as any)).toBe(false);

      // Non-string types
      expect(containsProfanity(123 as any)).toBe(false);
      expect(containsProfanity({} as any)).toBe(false);
      expect(containsProfanity([] as any)).toBe(false);

      // Whitespace
      expect(containsProfanity("   ")).toBe(false);
      expect(containsProfanity("\n\t")).toBe(false);
    });

    test("should handle usernames with special characters", () => {
      const specialCharUsernames = [
        "fuck!@#",
        "shit$$$",
        "damn***",
        "hell---",
        "user_fuck_123",
        "gamer@shit.com",
        "fuck.user.name",
        "shit_happens_2024",
      ];

      specialCharUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    test("should not flag innocent words that don't contain profanity", () => {
      // These are legitimate words that don't contain any profane substrings from our word list
      const innocentWords = [
        "classic", // doesn't contain any profane words
        "grass", // doesn't contain any profane words
        "glass", // doesn't contain any profane words
        "passing", // doesn't contain any profane words
        "assassin", // doesn't contain any profane words
        "assistance", // doesn't contain any profane words
        "assignment", // doesn't contain any profane words
      ];

      innocentWords.forEach((username) => {
        expect(containsProfanity(username)).toBe(false);
      });
    });

    test("should handle trimming whitespace", () => {
      const whitespaceUsernames = ["  fuck  ", "\tshit\t", "\n damn \n", "  hell  ", " crap "];

      whitespaceUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });
  });

  describe("validateUsernameForProfanity", () => {
    test("should return empty string for clean usernames", () => {
      const cleanUsernames = ["username123", "goodUser", "player1", "awesomeGamer", "coolDude"];

      cleanUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe("");
      });
    });

    test("should return error message for profane usernames", () => {
      const profaneUsernames = ["fuck123", "shittyUser", "bitchPlayer", "cunt", "asshole_gamer", "hellBoy"];

      const expectedErrorMessage = "Username contains inappropriate language. Please choose a different username.";

      profaneUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe(expectedErrorMessage);
      });
    });

    test("should handle edge cases consistently with containsProfanity", () => {
      // Empty string
      expect(validateUsernameForProfanity("")).toBe("");

      // Null/undefined
      expect(validateUsernameForProfanity(null as any)).toBe("");
      expect(validateUsernameForProfanity(undefined as any)).toBe("");

      // Non-string types
      expect(validateUsernameForProfanity(123 as any)).toBe("");
      expect(validateUsernameForProfanity({} as any)).toBe("");
      expect(validateUsernameForProfanity([] as any)).toBe("");
    });

    test("should return consistent error message", () => {
      const expectedMessage = "Username contains inappropriate language. Please choose a different username.";

      expect(validateUsernameForProfanity("fuck")).toBe(expectedMessage);
      expect(validateUsernameForProfanity("shit")).toBe(expectedMessage);
      expect(validateUsernameForProfanity("damn")).toBe(expectedMessage);

      // Test with a word that actually contains profanity
      expect(validateUsernameForProfanity("fuckUser123")).toBe(expectedMessage);
    });
  });

  describe("Integration tests", () => {
    test("containsProfanity and validateUsernameForProfanity should be consistent", () => {
      const testCases = [
        {username: "cleanUser", shouldBeProfane: false},
        {username: "fuckUser", shouldBeProfane: true},
        {username: "cunt", shouldBeProfane: true},
        {username: "shittyGamer", shouldBeProfane: true},
        {username: "goodPlayer", shouldBeProfane: false},
        {username: "damn123", shouldBeProfane: true},
        {username: "awesomeUser", shouldBeProfane: false},
        {username: "hellPlayer", shouldBeProfane: true},
        {username: "normalGamer", shouldBeProfane: false},
      ];

      testCases.forEach(({username, shouldBeProfane}) => {
        const containsResult = containsProfanity(username);
        const validateResult = validateUsernameForProfanity(username);

        expect(containsResult).toBe(shouldBeProfane);

        if (shouldBeProfane) {
          expect(validateResult).toBe("Username contains inappropriate language. Please choose a different username.");
        } else {
          expect(validateResult).toBe("");
        }
      });
    });
  });
});
