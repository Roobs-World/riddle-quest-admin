import {
  containsProfanity,
  validateUsernameForProfanity,
} from "../profanityFilter";

describe("profanityFilter", () => {
  describe("containsProfanity", () => {
    it("should return false for clean usernames", () => {
      const cleanUsernames = [
        "john",
        "mary",
        "player123",
        "cooluser",
        "gamer2023",
        "username",
        "test",
        "alice",
        "bob",
        "charlie",
        "diana",
        "edward",
        "fiona",
        "george",
        "helen",
      ];

      cleanUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(false);
      });
    });

    it("should return true for usernames containing profanity", () => {
      // Testing with some mild words from the filter list
      const profaneUsernames = [
        "damn",
        "hell",
        "crap",
        "badword",
        "adult",
        "kill",
        "die",
      ];

      profaneUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    it("should detect profanity in mixed case usernames", () => {
      const mixedCaseUsernames = ["DAMN", "Hell", "CrAp", "BADWORD", "AdUlT"];

      mixedCaseUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    it("should detect profanity as substrings", () => {
      const substringUsernames = [
        "userdamn123",
        "helluser",
        "mycrapname",
        "adultgamer",
        "badwordtest",
      ];

      substringUsernames.forEach((username) => {
        expect(containsProfanity(username)).toBe(true);
      });
    });

    it("should detect profanity with word boundaries", () => {
      // Test individual cases we know should work
      expect(containsProfanity("user damn user")).toBe(true);
      expect(containsProfanity("hell world")).toBe(true);
      expect(containsProfanity("my crap name")).toBe(true);
      expect(containsProfanity("adult game")).toBe(true);
      // "bad word test" contains "badword" which is not in our filter
      expect(containsProfanity("kill game")).toBe(true);
    });

    it("should handle edge cases with invalid input", () => {
      expect(containsProfanity("")).toBe(false);
      expect(containsProfanity("   ")).toBe(false);
      expect(containsProfanity(null as any)).toBe(false);
      expect(containsProfanity(undefined as any)).toBe(false);
      expect(containsProfanity(123 as any)).toBe(false);
      expect(containsProfanity({} as any)).toBe(false);
      expect(containsProfanity([] as any)).toBe(false);
    });

    it("should handle usernames with special characters", () => {
      expect(containsProfanity("user@name")).toBe(false);
      expect(containsProfanity("user.name")).toBe(false);
      expect(containsProfanity("user-name")).toBe(false);
      expect(containsProfanity("user_name")).toBe(false);
      expect(containsProfanity("user123!")).toBe(false);
      expect(containsProfanity("damn@user")).toBe(true);
      expect(containsProfanity("user.damn")).toBe(true);
    });

    it("should handle very long usernames", () => {
      const longCleanUsername = "a".repeat(100);
      expect(containsProfanity(longCleanUsername)).toBe(false);

      const longProfaneUsername = "a".repeat(50) + "damn" + "b".repeat(50);
      expect(containsProfanity(longProfaneUsername)).toBe(true);
    });

    it("should handle usernames with repeated characters", () => {
      expect(containsProfanity("aaaaaa")).toBe(false);
      expect(containsProfanity("111111")).toBe(false);
      expect(containsProfanity("damnnn")).toBe(true);
      // "heeellll" doesn't contain exact "hell", but let's test what actually works
      expect(containsProfanity("hellll")).toBe(true);
      expect(containsProfanity("crapp")).toBe(true);
    });

    it("should handle whitespace around usernames", () => {
      expect(containsProfanity("  cleanuser  ")).toBe(false);
      expect(containsProfanity("  damn  ")).toBe(true);
      expect(containsProfanity("\tcrap\n")).toBe(true);
      expect(containsProfanity("\r\nhell\r\n")).toBe(true);
    });
  });

  describe("validateUsernameForProfanity", () => {
    it("should return empty string for clean usernames", () => {
      const cleanUsernames = [
        "john",
        "mary",
        "player123",
        "cooluser",
        "gamer2023",
        "username",
        "test",
      ];

      cleanUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe("");
      });
    });

    it("should return error message for profane usernames", () => {
      const profaneUsernames = ["damn", "hell", "crap", "badword", "adult"];

      const expectedMessage =
        "Username contains inappropriate language. Please choose a different username.";

      profaneUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe(expectedMessage);
      });
    });

    it("should return error message for profane usernames with mixed case", () => {
      const mixedCaseUsernames = ["DAMN", "Hell", "CrAp", "BADWORD"];

      const expectedMessage =
        "Username contains inappropriate language. Please choose a different username.";

      mixedCaseUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe(expectedMessage);
      });
    });

    it("should return error message for usernames with profanity as substrings", () => {
      const substringUsernames = [
        "userdamn123",
        "helluser",
        "mycrapname",
        "adultgamer",
      ];

      const expectedMessage =
        "Username contains inappropriate language. Please choose a different username.";

      substringUsernames.forEach((username) => {
        expect(validateUsernameForProfanity(username)).toBe(expectedMessage);
      });
    });

    it("should handle edge cases with invalid input", () => {
      expect(validateUsernameForProfanity("")).toBe("");
      expect(validateUsernameForProfanity("   ")).toBe("");
      expect(validateUsernameForProfanity(null as any)).toBe("");
      expect(validateUsernameForProfanity(undefined as any)).toBe("");
      expect(validateUsernameForProfanity(123 as any)).toBe("");
    });

    it("should handle usernames with whitespace", () => {
      expect(validateUsernameForProfanity("  cleanuser  ")).toBe("");

      const expectedMessage =
        "Username contains inappropriate language. Please choose a different username.";
      expect(validateUsernameForProfanity("  damn  ")).toBe(expectedMessage);
      expect(validateUsernameForProfanity("\tcrap\n")).toBe(expectedMessage);
    });
  });

  describe("Integration tests", () => {
    it("should work together consistently", () => {
      const testCases = [
        { username: "cleanuser", shouldHaveProfanity: false },
        { username: "damn", shouldHaveProfanity: true },
        { username: "hell", shouldHaveProfanity: true },
        { username: "gooduser123", shouldHaveProfanity: false },
        { username: "usercrap", shouldHaveProfanity: true },
        { username: "", shouldHaveProfanity: false },
        { username: "   ", shouldHaveProfanity: false },
      ];

      testCases.forEach(({ username, shouldHaveProfanity }) => {
        const containsResult = containsProfanity(username);
        const validateResult = validateUsernameForProfanity(username);

        expect(containsResult).toBe(shouldHaveProfanity);

        if (shouldHaveProfanity) {
          expect(validateResult).toBe(
            "Username contains inappropriate language. Please choose a different username."
          );
        } else {
          expect(validateResult).toBe("");
        }
      });
    });

    it("should handle boundary conditions consistently", () => {
      // Test each case individually to avoid issues
      expect(containsProfanity("user")).toBe(false);
      expect(containsProfanity("username")).toBe(false);
      expect(containsProfanity("verylongusername123456")).toBe(false);
      expect(containsProfanity("userwithnumbers123")).toBe(false);
      expect(containsProfanity("user.with.dots")).toBe(false);
      expect(containsProfanity("user_with_underscores")).toBe(false);
      expect(containsProfanity("user-with-hyphens")).toBe(false);

      // Test validation as well
      expect(validateUsernameForProfanity("user")).toBe("");
      expect(validateUsernameForProfanity("username")).toBe("");
      expect(validateUsernameForProfanity("userwithnumbers123")).toBe("");
    });
  });
});
