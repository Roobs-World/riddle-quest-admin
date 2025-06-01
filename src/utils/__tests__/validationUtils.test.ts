/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the validation utilities to test
import { ValidationUtils } from "../validationUtils";
import { z } from "zod";

describe("ValidationUtils", () => {
  describe("Zod Error Handling", () => {
    describe("isZodError", () => {
      test("should detect ZodError instances", () => {
        const schema = z.object({ email: z.string().email() });

        try {
          schema.parse({ email: "invalid-email" });
        } catch (error) {
          expect(ValidationUtils.isZodError(error)).toBe(true);
        }
      });

      test("should not detect non-ZodError instances", () => {
        const nonZodErrors = [
          new Error("Regular error"),
          { message: "Object error" },
          "string error",
          null,
          undefined,
        ];

        nonZodErrors.forEach((error) => {
          expect(ValidationUtils.isZodError(error)).toBe(false);
        });
      });
    });

    describe("formatZodError", () => {
      test("should format Zod validation errors", () => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().min(18),
          name: z.string().min(1),
        });

        try {
          schema.parse({
            email: "invalid-email",
            age: 16,
            name: "",
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = ValidationUtils.formatZodError(error);

            expect(typeof formatted).toBe("string");
            expect(formatted.length).toBeGreaterThan(0);

            // Check that error messages contain field paths
            expect(formatted).toContain("email");
            expect(formatted).toContain("age");
            expect(formatted).toContain("name");
          }
        }
      });

      test("should handle nested object validation errors", () => {
        const schema = z.object({
          user: z.object({
            profile: z.object({
              email: z.string().email(),
            }),
          }),
        });

        try {
          schema.parse({
            user: {
              profile: {
                email: "invalid",
              },
            },
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = ValidationUtils.formatZodError(error);

            expect(formatted).toContain("user.profile.email");
          }
        }
      });

      test("should handle array validation errors", () => {
        const schema = z.object({
          items: z.array(z.string().min(1)),
        });

        try {
          schema.parse({
            items: ["valid", "", "also-valid"],
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = ValidationUtils.formatZodError(error);

            expect(formatted).toContain("items.1");
          }
        }
      });
    });
  });

  describe("String Validation", () => {
    describe("isNonEmptyString", () => {
      test("should return true for non-empty strings", () => {
        expect(ValidationUtils.isNonEmptyString("hello")).toBe(true);
        expect(ValidationUtils.isNonEmptyString("test")).toBe(true);
        expect(ValidationUtils.isNonEmptyString("123")).toBe(true);
        expect(ValidationUtils.isNonEmptyString("!@#")).toBe(true);
      });

      test("should return false for empty strings and whitespace", () => {
        expect(ValidationUtils.isNonEmptyString("")).toBe(false);
        expect(ValidationUtils.isNonEmptyString(" ")).toBe(false);
        expect(ValidationUtils.isNonEmptyString("   ")).toBe(false);
        expect(ValidationUtils.isNonEmptyString("\t")).toBe(false);
        expect(ValidationUtils.isNonEmptyString("\n")).toBe(false);
      });

      test("should return false for non-strings", () => {
        expect(ValidationUtils.isNonEmptyString(123 as any)).toBe(false);
        expect(ValidationUtils.isNonEmptyString(null as any)).toBe(false);
        expect(ValidationUtils.isNonEmptyString(undefined as any)).toBe(false);
        expect(ValidationUtils.isNonEmptyString({} as any)).toBe(false);
        expect(ValidationUtils.isNonEmptyString([] as any)).toBe(false);
        expect(ValidationUtils.isNonEmptyString(true as any)).toBe(false);
      });
    });

    describe("isValidEmail", () => {
      test("should return true for valid email addresses", () => {
        const validEmails = [
          "test@example.com",
          "user.name@domain.co.uk",
          "user+tag@example.org",
          "123@numbers.com",
          "user-name@example-domain.com",
          "a@b.co",
        ];

        validEmails.forEach((email) => {
          expect(ValidationUtils.isValidEmail(email)).toBe(true);
        });
      });

      test("should return false for invalid email addresses", () => {
        const invalidEmails = [
          "invalid",
          "invalid@",
          "@invalid.com",
          "invalid.com",
          "",
          " ",
          "user@",
          "user@domain",
          "user@@domain.com",
          "user@domain..com",
          "user@.domain.com",
          ".user@domain.com",
        ];

        invalidEmails.forEach((email) => {
          expect(ValidationUtils.isValidEmail(email)).toBe(false);
        });
      });
    });

    describe("isValidPassword", () => {
      test("should return true for passwords meeting minimum length", () => {
        const validPasswords = [
          "password",
          "123456",
          "simple",
          "longerpassword",
          "Password123!",
        ];

        validPasswords.forEach((password) => {
          expect(ValidationUtils.isValidPassword(password)).toBe(true);
        });
      });

      test("should return false for passwords below minimum length", () => {
        const invalidPasswords = [
          "short", // 5 characters
          "12345", // 5 characters
          "pass", // 4 characters
          "", // Empty
          "a", // 1 character
        ];

        invalidPasswords.forEach((password) => {
          expect(ValidationUtils.isValidPassword(password)).toBe(false);
        });
      });
    });

    describe("isValidGuess", () => {
      test("should return true for valid guesses with default length", () => {
        const validGuesses = [
          "HELLO",
          "WORLD",
          "GAMES",
          "TESTS",
          "GUESS",
          "abcde",
          "Mixed",
        ];

        validGuesses.forEach((guess) => {
          expect(ValidationUtils.isValidGuess(guess)).toBe(true);
        });
      });

      test("should return true for valid guesses with custom length", () => {
        expect(ValidationUtils.isValidGuess("WORD", 4)).toBe(true);
        expect(ValidationUtils.isValidGuess("TESTING", 7)).toBe(true);
        expect(ValidationUtils.isValidGuess("ab", 2)).toBe(true);
      });

      test("should return false for invalid guesses", () => {
        const invalidGuesses = [
          "HELL", // Too short (4 chars, expects 5)
          "TOOLONG", // Too long (7 chars, expects 5)
          "HELL0", // Contains number
          "HELL!", // Contains special character
          "HEL O", // Contains space
          "", // Empty
          " ", // Just space
        ];

        invalidGuesses.forEach((guess) => {
          expect(ValidationUtils.isValidGuess(guess)).toBe(false);
        });
      });

      test("should handle non-strings", () => {
        expect(ValidationUtils.isValidGuess(null as any)).toBe(false);
        expect(ValidationUtils.isValidGuess(undefined as any)).toBe(false);
        expect(ValidationUtils.isValidGuess(123 as any)).toBe(false);
        expect(ValidationUtils.isValidGuess({} as any)).toBe(false);
      });
    });

    describe("isValidUserId", () => {
      test("should return true for valid user IDs", () => {
        expect(ValidationUtils.isValidUserId("user123")).toBe(true);
        expect(ValidationUtils.isValidUserId("valid-user-id")).toBe(true);
        expect(ValidationUtils.isValidUserId("a")).toBe(true);
        expect(ValidationUtils.isValidUserId("123")).toBe(true);
      });

      test("should return false for invalid user IDs", () => {
        expect(ValidationUtils.isValidUserId("")).toBe(false);
        expect(ValidationUtils.isValidUserId(" ")).toBe(false);
        expect(ValidationUtils.isValidUserId(null)).toBe(false);
        expect(ValidationUtils.isValidUserId(undefined)).toBe(false);
        expect(ValidationUtils.isValidUserId(123 as any)).toBe(false);
        expect(ValidationUtils.isValidUserId({} as any)).toBe(false);
      });
    });

    describe("isValidRiddleId", () => {
      test("should return true for valid riddle IDs", () => {
        expect(ValidationUtils.isValidRiddleId("riddle123")).toBe(true);
        expect(ValidationUtils.isValidRiddleId("valid-riddle-id")).toBe(true);
        expect(ValidationUtils.isValidRiddleId("a")).toBe(true);
        expect(ValidationUtils.isValidRiddleId("123")).toBe(true);
      });

      test("should return false for invalid riddle IDs", () => {
        expect(ValidationUtils.isValidRiddleId("")).toBe(false);
        expect(ValidationUtils.isValidRiddleId(" ")).toBe(false);
        expect(ValidationUtils.isValidRiddleId(null)).toBe(false);
        expect(ValidationUtils.isValidRiddleId(undefined)).toBe(false);
        expect(ValidationUtils.isValidRiddleId(123 as any)).toBe(false);
        expect(ValidationUtils.isValidRiddleId({} as any)).toBe(false);
      });
    });

    describe("isValidDateString", () => {
      test("should return true for valid date strings", () => {
        const validDates = [
          "2024-01-01",
          "2024-12-31",
          "2023-06-15",
          "2000-02-29", // Leap year
          "1999-12-31",
        ];

        validDates.forEach((date) => {
          expect(ValidationUtils.isValidDateString(date)).toBe(true);
        });
      });

      test("should return false for invalid date strings", () => {
        const invalidDates = [
          "2024-13-01", // Invalid month
          "2024-00-01", // Invalid month
          "2024-01-32", // Invalid day
          "2024-01-00", // Invalid day
          "2023-02-29", // Invalid leap year
          "24-01-01", // Wrong year format
          "2024-1-1", // Wrong month/day format
          "2024/01/01", // Wrong separator
          "01-01-2024", // Wrong order
          "", // Empty
          "invalid", // Not a date
          "2024-01", // Incomplete
          "2024-01-01-01", // Too many parts
        ];

        invalidDates.forEach((date) => {
          expect(ValidationUtils.isValidDateString(date)).toBe(false);
        });
      });
    });

    describe("isValidGameMode", () => {
      test("should return true for valid game modes", () => {
        expect(ValidationUtils.isValidGameMode("daily")).toBe(true);
        expect(ValidationUtils.isValidGameMode("classic")).toBe(true);
        expect(ValidationUtils.isValidGameMode("tutorial")).toBe(true);
      });

      test("should return false for invalid game modes", () => {
        expect(ValidationUtils.isValidGameMode("invalid")).toBe(false);
        expect(ValidationUtils.isValidGameMode("")).toBe(false);
        expect(ValidationUtils.isValidGameMode("DAILY")).toBe(false);
        expect(ValidationUtils.isValidGameMode("Classic")).toBe(false);
        expect(ValidationUtils.isValidGameMode(null)).toBe(false);
        expect(ValidationUtils.isValidGameMode(undefined)).toBe(false);
        expect(ValidationUtils.isValidGameMode(123 as any)).toBe(false);
        expect(ValidationUtils.isValidGameMode({} as any)).toBe(false);
      });
    });
  });

  describe("Number Validation", () => {
    describe("isPositiveNumber", () => {
      test("should return true for positive numbers", () => {
        expect(ValidationUtils.isPositiveNumber(1)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(100)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(0.1)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(Infinity)).toBe(true);
      });

      test("should return false for zero, negative numbers, and non-numbers", () => {
        expect(ValidationUtils.isPositiveNumber(0)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(-1)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(-0.1)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(-Infinity)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(NaN)).toBe(false);
        expect(ValidationUtils.isPositiveNumber("1" as any)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(null as any)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(undefined as any)).toBe(false);
      });
    });

    describe("isNonNegativeNumber", () => {
      test("should return true for zero and positive numbers", () => {
        expect(ValidationUtils.isNonNegativeNumber(0)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(1)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(100)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(0.1)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(Infinity)).toBe(true);
      });

      test("should return false for negative numbers and non-numbers", () => {
        expect(ValidationUtils.isNonNegativeNumber(-1)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(-0.1)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(-Infinity)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(NaN)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber("0" as any)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(null as any)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(undefined as any)).toBe(
          false
        );
      });
    });

    describe("isInRange", () => {
      test("should return true for numbers within range", () => {
        expect(ValidationUtils.isInRange(5, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(0, -5, 5)).toBe(true);
        expect(ValidationUtils.isInRange(-3, -10, 0)).toBe(true);
      });

      test("should return true for numbers on range boundaries", () => {
        expect(ValidationUtils.isInRange(1, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(10, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(0, 0, 0)).toBe(true);
      });

      test("should return false for numbers outside range", () => {
        expect(ValidationUtils.isInRange(0, 1, 10)).toBe(false);
        expect(ValidationUtils.isInRange(11, 1, 10)).toBe(false);
        expect(ValidationUtils.isInRange(-1, 0, 10)).toBe(false);
      });

      test("should handle decimal numbers", () => {
        expect(ValidationUtils.isInRange(5.5, 1.1, 10.9)).toBe(true);
        expect(ValidationUtils.isInRange(1.0, 1.1, 10.9)).toBe(false);
        expect(ValidationUtils.isInRange(11.0, 1.1, 10.9)).toBe(false);
      });
    });
  });

  describe("Array Validation", () => {
    describe("hasMinLength", () => {
      test("should return true for arrays meeting minimum length", () => {
        expect(ValidationUtils.hasMinLength([1, 2, 3], 3)).toBe(true);
        expect(ValidationUtils.hasMinLength([1, 2, 3], 2)).toBe(true);
        expect(ValidationUtils.hasMinLength([], 0)).toBe(true);
        expect(ValidationUtils.hasMinLength(["a", "b", "c", "d"], 3)).toBe(
          true
        );
      });

      test("should return false for arrays below minimum length", () => {
        expect(ValidationUtils.hasMinLength([1, 2], 3)).toBe(false);
        expect(ValidationUtils.hasMinLength([], 1)).toBe(false);
        expect(ValidationUtils.hasMinLength(["a"], 2)).toBe(false);
      });

      test("should handle non-arrays", () => {
        expect(ValidationUtils.hasMinLength("string" as any, 3)).toBe(false);
        expect(ValidationUtils.hasMinLength(123 as any, 0)).toBe(false);
        expect(ValidationUtils.hasMinLength(null as any, 0)).toBe(false);
        expect(ValidationUtils.hasMinLength(undefined as any, 0)).toBe(false);
        expect(ValidationUtils.hasMinLength({} as any, 0)).toBe(false);
      });
    });

    describe("hasMaxLength", () => {
      test("should return true for arrays within maximum length", () => {
        expect(ValidationUtils.hasMaxLength([1, 2, 3], 5)).toBe(true);
        expect(ValidationUtils.hasMaxLength([1, 2, 3], 3)).toBe(true);
        expect(ValidationUtils.hasMaxLength([], 5)).toBe(true);
        expect(ValidationUtils.hasMaxLength(["a"], 3)).toBe(true);
      });

      test("should return false for arrays exceeding maximum length", () => {
        expect(ValidationUtils.hasMaxLength([1, 2, 3, 4], 3)).toBe(false);
        expect(ValidationUtils.hasMaxLength(["a", "b", "c"], 2)).toBe(false);
      });

      test("should handle non-arrays", () => {
        expect(ValidationUtils.hasMaxLength("string" as any, 5)).toBe(false);
        expect(ValidationUtils.hasMaxLength(123 as any, 5)).toBe(false);
        expect(ValidationUtils.hasMaxLength(null as any, 5)).toBe(false);
        expect(ValidationUtils.hasMaxLength(undefined as any, 5)).toBe(false);
        expect(ValidationUtils.hasMaxLength({} as any, 5)).toBe(false);
      });
    });
  });

  describe("JSON Validation", () => {
    describe("safeJsonParse", () => {
      test("should parse valid JSON strings", () => {
        expect(ValidationUtils.safeJsonParse('{"key": "value"}', {})).toEqual({
          key: "value",
        });
        expect(ValidationUtils.safeJsonParse("[1, 2, 3]", [])).toEqual([
          1, 2, 3,
        ]);
        expect(ValidationUtils.safeJsonParse('"string"', "")).toBe("string");
        expect(ValidationUtils.safeJsonParse("123", 0)).toBe(123);
        expect(ValidationUtils.safeJsonParse("true", false)).toBe(true);
        expect(ValidationUtils.safeJsonParse("null", "fallback")).toBe(null);
      });

      test("should return fallback for invalid JSON strings", () => {
        const fallback = { default: true };
        expect(
          ValidationUtils.safeJsonParse('{"invalid": json}', fallback)
        ).toBe(fallback);
        expect(ValidationUtils.safeJsonParse("invalid", fallback)).toBe(
          fallback
        );
        expect(ValidationUtils.safeJsonParse("", fallback)).toBe(fallback);
        expect(ValidationUtils.safeJsonParse("{", fallback)).toBe(fallback);
      });

      test("should handle different fallback types", () => {
        expect(ValidationUtils.safeJsonParse("invalid", "fallback")).toBe(
          "fallback"
        );
        expect(ValidationUtils.safeJsonParse("invalid", 42)).toBe(42);
        expect(ValidationUtils.safeJsonParse("invalid", [])).toEqual([]);
        expect(ValidationUtils.safeJsonParse("invalid", null)).toBe(null);
      });
    });
  });

  describe("Integration Tests", () => {
    test("should work together for user input validation", () => {
      const userInput = {
        userId: "user123",
        email: "test@example.com",
        guess: "HELLO",
        score: 100,
        gameMode: "daily",
      };

      expect(ValidationUtils.isValidUserId(userInput.userId)).toBe(true);
      expect(ValidationUtils.isValidEmail(userInput.email)).toBe(true);
      expect(ValidationUtils.isValidGuess(userInput.guess)).toBe(true);
      expect(ValidationUtils.isPositiveNumber(userInput.score)).toBe(true);
      expect(ValidationUtils.isValidGameMode(userInput.gameMode)).toBe(true);
    });

    test("should handle edge cases consistently", () => {
      const edgeCases = [null, undefined, "", 0, false, {}, []];

      edgeCases.forEach((value) => {
        expect(ValidationUtils.isValidUserId(value)).toBe(false);
        expect(ValidationUtils.isValidRiddleId(value)).toBe(false);
        expect(ValidationUtils.isValidGameMode(value)).toBe(false);
      });
    });

    test("should validate riddle game data", () => {
      const riddleData = {
        riddleId: "riddle_123",
        answer: "HELLO",
        difficulty: 3,
        hints: ["clue1", "clue2"],
        date: "2024-01-15",
      };

      expect(ValidationUtils.isValidRiddleId(riddleData.riddleId)).toBe(true);
      expect(ValidationUtils.isValidGuess(riddleData.answer)).toBe(true);
      expect(ValidationUtils.isPositiveNumber(riddleData.difficulty)).toBe(
        true
      );
      expect(ValidationUtils.hasMinLength(riddleData.hints, 1)).toBe(true);
      expect(ValidationUtils.isValidDateString(riddleData.date)).toBe(true);
    });

    test("should validate array operations", () => {
      const scores = [100, 85, 92, 78, 95];
      const emptyArray: number[] = [];
      const singleItem = [42];

      expect(ValidationUtils.hasMinLength(scores, 3)).toBe(true);
      expect(ValidationUtils.hasMaxLength(scores, 10)).toBe(true);
      expect(ValidationUtils.hasMinLength(emptyArray, 0)).toBe(true);
      expect(ValidationUtils.hasMaxLength(emptyArray, 5)).toBe(true);
      expect(ValidationUtils.hasMinLength(singleItem, 1)).toBe(true);
      expect(ValidationUtils.hasMaxLength(singleItem, 1)).toBe(true);
    });

    test("should handle JSON parsing in validation flow", () => {
      const validJsonString = '{"userId": "test123", "score": 85}';
      const invalidJsonString = '{"userId": "test123", "score": }';
      const fallback = { userId: "", score: 0 };

      const validParsed = ValidationUtils.safeJsonParse(
        validJsonString,
        fallback
      );
      const invalidParsed = ValidationUtils.safeJsonParse(
        invalidJsonString,
        fallback
      );

      expect(validParsed).not.toBe(fallback);
      expect(ValidationUtils.isNonEmptyString(validParsed.userId)).toBe(true);
      expect(ValidationUtils.isPositiveNumber(validParsed.score)).toBe(true);

      expect(invalidParsed).toBe(fallback);
      expect(ValidationUtils.isNonEmptyString(invalidParsed.userId)).toBe(
        false
      );
      expect(ValidationUtils.isPositiveNumber(invalidParsed.score)).toBe(false);
    });
  });
});
