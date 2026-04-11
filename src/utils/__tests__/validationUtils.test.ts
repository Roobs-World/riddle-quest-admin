/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the validation utilities to test
import { ValidationUtils } from "../validationUtils";
import { z } from "zod";
import { ZodError } from "zod";

describe("ValidationUtils", () => {
  describe("Zod Error Handling", () => {
    describe("isZodError", () => {
      it("should return true for ZodError instances", () => {
        const schema = z.string();
        try {
          schema.parse(123);
        } catch (error) {
          expect(ValidationUtils.isZodError(error)).toBe(true);
        }
      });

      it("should return false for non-ZodError instances", () => {
        expect(ValidationUtils.isZodError(new Error("Regular error"))).toBe(
          false
        );
        expect(ValidationUtils.isZodError("string")).toBe(false);
        expect(ValidationUtils.isZodError(null)).toBe(false);
        expect(ValidationUtils.isZodError(undefined)).toBe(false);
      });
    });

    describe("formatZodError", () => {
      it("should format ZodError with single issue", () => {
        const schema = z.object({ name: z.string() });
        try {
          schema.parse({ name: 123 });
        } catch (error) {
          if (error instanceof ZodError) {
            const formatted = ValidationUtils.formatZodError(error);
            expect(formatted).toContain("name");
            expect(formatted).toMatch(/expected string|Expected string/i);
          }
        }
      });

      it("should format ZodError with multiple issues", () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });
        try {
          schema.parse({ name: 123, age: "invalid" });
        } catch (error) {
          if (error instanceof ZodError) {
            const formatted = ValidationUtils.formatZodError(error);
            expect(formatted).toContain("name");
            expect(formatted).toContain("age");
            expect(formatted).toContain(",");
          }
        }
      });
    });
  });

  describe("String Validation", () => {
    describe("isNonEmptyString", () => {
      it("should return true for valid non-empty strings", () => {
        expect(ValidationUtils.isNonEmptyString("hello")).toBe(true);
        expect(ValidationUtils.isNonEmptyString("  hello  ")).toBe(true);
        expect(ValidationUtils.isNonEmptyString("a")).toBe(true);
      });

      it("should return false for empty or whitespace strings", () => {
        expect(ValidationUtils.isNonEmptyString("")).toBe(false);
        expect(ValidationUtils.isNonEmptyString("   ")).toBe(false);
        expect(ValidationUtils.isNonEmptyString("\t\n")).toBe(false);
      });

      it("should return false for non-string values", () => {
        expect(ValidationUtils.isNonEmptyString(null)).toBe(false);
        expect(ValidationUtils.isNonEmptyString(undefined)).toBe(false);
        expect(ValidationUtils.isNonEmptyString(123)).toBe(false);
        expect(ValidationUtils.isNonEmptyString({})).toBe(false);
        expect(ValidationUtils.isNonEmptyString([])).toBe(false);
      });
    });

    describe("isValidEmail", () => {
      it("should return true for valid email addresses", () => {
        expect(ValidationUtils.isValidEmail("test@example.com")).toBe(true);
        expect(ValidationUtils.isValidEmail("user.name+tag@domain.co.uk")).toBe(
          true
        );
        expect(ValidationUtils.isValidEmail("simple@test.io")).toBe(true);
        expect(
          ValidationUtils.isValidEmail("user123@subdomain.example.org")
        ).toBe(true);
      });

      it("should return false for invalid email formats", () => {
        expect(ValidationUtils.isValidEmail("invalid-email")).toBe(false);
        expect(ValidationUtils.isValidEmail("@example.com")).toBe(false);
        expect(ValidationUtils.isValidEmail("test@")).toBe(false);
        expect(ValidationUtils.isValidEmail("test.example.com")).toBe(false);
      });

      it("should return false for emails with consecutive dots", () => {
        expect(ValidationUtils.isValidEmail("test..email@example.com")).toBe(
          false
        );
        expect(ValidationUtils.isValidEmail(".test@example.com")).toBe(false);
        expect(ValidationUtils.isValidEmail("test@example.com.")).toBe(false);
      });

      it("should return false for non-string or empty values", () => {
        expect(ValidationUtils.isValidEmail("")).toBe(false);
        expect(ValidationUtils.isValidEmail(null as any)).toBe(false);
        expect(ValidationUtils.isValidEmail(undefined as any)).toBe(false);
        expect(ValidationUtils.isValidEmail(123 as any)).toBe(false);
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
      it("should return true for valid guesses", () => {
        expect(ValidationUtils.isValidGuess("HELLO", 5)).toBe(true);
        expect(ValidationUtils.isValidGuess("WORLD", 5)).toBe(true);
        expect(ValidationUtils.isValidGuess("ABC", 3)).toBe(true);
        expect(ValidationUtils.isValidGuess("hello", 5)).toBe(true); // Should handle lowercase
      });

      it("should return false for incorrect length", () => {
        expect(ValidationUtils.isValidGuess("HELLO", 4)).toBe(false);
        expect(ValidationUtils.isValidGuess("HI", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess("TOOLONG", 5)).toBe(false);
      });

      it("should return false for non-letter characters", () => {
        expect(ValidationUtils.isValidGuess("HEL1O", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess("HEL O", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess("HEL-O", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess("HEL@O", 5)).toBe(false);
      });

      it("should return false for empty or invalid inputs", () => {
        expect(ValidationUtils.isValidGuess("", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess("   ", 5)).toBe(false);
        expect(ValidationUtils.isValidGuess(null as any, 5)).toBe(false);
        expect(ValidationUtils.isValidGuess(undefined as any, 5)).toBe(false);
      });
    });

    describe("isValidUserId", () => {
      it("should return true for valid user IDs", () => {
        expect(ValidationUtils.isValidUserId("user123")).toBe(true);
        expect(ValidationUtils.isValidUserId("a")).toBe(true);
        expect(ValidationUtils.isValidUserId("very-long-user-id-12345")).toBe(
          true
        );
      });

      it("should return false for invalid user IDs", () => {
        expect(ValidationUtils.isValidUserId("")).toBe(false);
        expect(ValidationUtils.isValidUserId("   ")).toBe(false);
        expect(ValidationUtils.isValidUserId(null)).toBe(false);
        expect(ValidationUtils.isValidUserId(undefined)).toBe(false);
        expect(ValidationUtils.isValidUserId(123)).toBe(false);
      });
    });

    describe("isValidRiddleId", () => {
      it("should return true for valid riddle IDs", () => {
        expect(ValidationUtils.isValidRiddleId("riddle123")).toBe(true);
        expect(ValidationUtils.isValidRiddleId("a")).toBe(true);
        expect(
          ValidationUtils.isValidRiddleId("very-long-riddle-id-12345")
        ).toBe(true);
      });

      it("should return false for invalid riddle IDs", () => {
        expect(ValidationUtils.isValidRiddleId("")).toBe(false);
        expect(ValidationUtils.isValidRiddleId("   ")).toBe(false);
        expect(ValidationUtils.isValidRiddleId(null)).toBe(false);
        expect(ValidationUtils.isValidRiddleId(undefined)).toBe(false);
        expect(ValidationUtils.isValidRiddleId(123)).toBe(false);
      });
    });

    describe("isValidDateString", () => {
      it("should return true for valid date strings", () => {
        expect(ValidationUtils.isValidDateString("2023-12-25")).toBe(true);
        expect(ValidationUtils.isValidDateString("2024-01-01")).toBe(true);
        expect(ValidationUtils.isValidDateString("2000-02-29")).toBe(true); // leap year
      });

      it("should return false for invalid date formats", () => {
        expect(ValidationUtils.isValidDateString("")).toBe(false);
        expect(ValidationUtils.isValidDateString("2023-12")).toBe(false);
        expect(ValidationUtils.isValidDateString("23-12-25")).toBe(false);
        expect(ValidationUtils.isValidDateString("2023/12/25")).toBe(false);
      });

      it("should return false for invalid dates", () => {
        expect(ValidationUtils.isValidDateString("2023-13-01")).toBe(false); // invalid month
        expect(ValidationUtils.isValidDateString("2023-12-32")).toBe(false); // invalid day
        expect(ValidationUtils.isValidDateString("2023-02-30")).toBe(false); // invalid day for February
        expect(ValidationUtils.isValidDateString("2001-02-29")).toBe(false); // not a leap year
      });

      it("should return false for non-string values", () => {
        expect(ValidationUtils.isValidDateString(null as any)).toBe(false);
        expect(ValidationUtils.isValidDateString(undefined as any)).toBe(false);
        expect(ValidationUtils.isValidDateString(20231225 as any)).toBe(false);
      });
    });

    describe("isValidGameMode", () => {
      test("should return true for valid game modes", () => {
        expect(ValidationUtils.isValidGameMode("daily")).toBe(true);
        expect(ValidationUtils.isValidGameMode("classic")).toBe(true);
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
      it("should return true for positive numbers", () => {
        expect(ValidationUtils.isPositiveNumber(1)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(0.1)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(100)).toBe(true);
        expect(ValidationUtils.isPositiveNumber(Number.MAX_VALUE)).toBe(true);
      });

      it("should return false for zero and negative numbers", () => {
        expect(ValidationUtils.isPositiveNumber(0)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(-1)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(-0.1)).toBe(false);
      });

      it("should return false for NaN and non-numbers", () => {
        expect(ValidationUtils.isPositiveNumber(NaN)).toBe(false);
        expect(ValidationUtils.isPositiveNumber("5")).toBe(false);
        expect(ValidationUtils.isPositiveNumber(null)).toBe(false);
        expect(ValidationUtils.isPositiveNumber(undefined)).toBe(false);
      });
    });

    describe("isNonNegativeNumber", () => {
      it("should return true for non-negative numbers", () => {
        expect(ValidationUtils.isNonNegativeNumber(0)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(1)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(0.1)).toBe(true);
        expect(ValidationUtils.isNonNegativeNumber(100)).toBe(true);
      });

      it("should return false for negative numbers", () => {
        expect(ValidationUtils.isNonNegativeNumber(-1)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(-0.1)).toBe(false);
      });

      it("should return false for NaN and non-numbers", () => {
        expect(ValidationUtils.isNonNegativeNumber(NaN)).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber("5")).toBe(false);
        expect(ValidationUtils.isNonNegativeNumber(null)).toBe(false);
      });
    });

    describe("isInRange", () => {
      it("should return true for values within range", () => {
        expect(ValidationUtils.isInRange(5, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(1, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(10, 1, 10)).toBe(true);
        expect(ValidationUtils.isInRange(0, -5, 5)).toBe(true);
      });

      it("should return false for values outside range", () => {
        expect(ValidationUtils.isInRange(0, 1, 10)).toBe(false);
        expect(ValidationUtils.isInRange(11, 1, 10)).toBe(false);
        expect(ValidationUtils.isInRange(-1, 0, 5)).toBe(false);
      });
    });
  });

  describe("Array Validation", () => {
    describe("hasMinLength", () => {
      it("should return true for arrays meeting minimum length", () => {
        expect(ValidationUtils.hasMinLength([1, 2, 3], 2)).toBe(true);
        expect(ValidationUtils.hasMinLength([1, 2, 3], 3)).toBe(true);
        expect(ValidationUtils.hasMinLength(["a"], 1)).toBe(true);
      });

      it("should return false for arrays below minimum length", () => {
        expect(ValidationUtils.hasMinLength([1, 2], 3)).toBe(false);
        expect(ValidationUtils.hasMinLength([], 1)).toBe(false);
        expect(ValidationUtils.hasMinLength(["a"], 2)).toBe(false);
      });

      it("should handle zero minimum length", () => {
        expect(ValidationUtils.hasMinLength([], 0)).toBe(true);
        expect(ValidationUtils.hasMinLength([1], 0)).toBe(true);
      });
    });

    describe("hasMaxLength", () => {
      it("should return true for arrays within maximum length", () => {
        expect(ValidationUtils.hasMaxLength([1, 2, 3], 3)).toBe(true);
        expect(ValidationUtils.hasMaxLength([1, 2], 3)).toBe(true);
        expect(ValidationUtils.hasMaxLength([], 0)).toBe(true);
      });

      it("should return false for arrays exceeding maximum length", () => {
        expect(ValidationUtils.hasMaxLength([1, 2, 3, 4], 3)).toBe(false);
        expect(ValidationUtils.hasMaxLength([1], 0)).toBe(false);
      });

      it("should return false for non-arrays", () => {
        expect(ValidationUtils.hasMaxLength("string" as any, 10)).toBe(false);
        expect(ValidationUtils.hasMaxLength(null as any, 10)).toBe(false);
        expect(ValidationUtils.hasMaxLength(undefined as any, 10)).toBe(false);
      });
    });
  });

  describe("JSON Validation", () => {
    describe("safeJsonParse", () => {
      it("should parse valid JSON", () => {
        const obj = { test: "value", number: 123 };
        const json = JSON.stringify(obj);
        const result = ValidationUtils.safeJsonParse(json, {});
        expect(result).toEqual(obj);
      });

      it("should return fallback for invalid JSON", () => {
        const fallback = { default: "value" };
        const result = ValidationUtils.safeJsonParse("invalid json", fallback);
        expect(result).toEqual(fallback);
      });

      it("should return fallback for empty string", () => {
        const fallback = "default";
        const result = ValidationUtils.safeJsonParse("", fallback);
        expect(result).toEqual(fallback);
      });

      it("should handle different fallback types", () => {
        expect(ValidationUtils.safeJsonParse("invalid", [])).toEqual([]);
        expect(ValidationUtils.safeJsonParse("invalid", 42)).toEqual(42);
        expect(ValidationUtils.safeJsonParse("invalid", null)).toEqual(null);
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
        hints: ["clue1", "clue2"],
        date: "2024-01-15",
      };

      expect(ValidationUtils.isValidRiddleId(riddleData.riddleId)).toBe(true);
      expect(ValidationUtils.isValidGuess(riddleData.answer)).toBe(true);
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

