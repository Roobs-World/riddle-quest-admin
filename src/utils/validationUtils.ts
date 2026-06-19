import {isValidGuess as isValidGuessCore} from "@qwordly/core";
import {ZodError} from "zod";

/**
 * Utility functions for data validation
 */
export class ValidationUtils {
  /**
   * Checks if an error is a Zod validation error
   */
  static isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError;
  }

  /**
   * Formats Zod validation errors into a readable string
   */
  static formatZodError(error: ZodError): string {
    return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
  }

  /**
   * Validates that a string is not empty or just whitespace
   */
  static isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  /**
   * Validates that a value is a positive number
   */
  static isPositiveNumber(value: unknown): value is number {
    return typeof value === "number" && value > 0 && !isNaN(value);
  }

  /**
   * Validates that a value is a non-negative number
   */
  static isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && value >= 0 && !isNaN(value);
  }

  /**
   * Validates email format using a more comprehensive regex
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== "string") {
      return false;
    }

    // More comprehensive email validation
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    // Basic structure check
    if (!emailRegex.test(email)) {
      return false;
    }

    // Additional checks for edge cases
    if (email.includes("..") || email.startsWith(".") || email.endsWith(".")) {
      return false;
    }

    if (email.includes("@@") || email.startsWith("@") || email.endsWith("@")) {
      return false;
    }

    // Must have exactly one @ symbol
    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) {
      return false;
    }

    // Check for dot immediately before @ symbol
    if (email.includes(".@")) {
      return false;
    }

    // Domain must have at least one dot after @
    const [, domain] = email.split("@");
    if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
      return false;
    }

    return true;
  }

  /**
   * Validates that a password meets minimum requirements
   */
  static isValidPassword(password: string): boolean {
    // At least 6 characters
    return password.length >= 6;
  }

  /**
   * Validates that a guess is the correct length and format
   */
  static isValidGuess(guess: string, expectedLength: number = 5): boolean {
    return isValidGuessCore(guess, expectedLength);
  }

  /**
   * Validates that a user ID is valid
   */
  static isValidUserId(userId: unknown): userId is string {
    return this.isNonEmptyString(userId) && userId.length > 0;
  }

  /**
   * Validates that a riddle ID is valid
   */
  static isValidRiddleId(riddleId: unknown): riddleId is string {
    return this.isNonEmptyString(riddleId) && riddleId.length > 0;
  }

  /**
   * Safely parses a JSON string
   */
  static safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }

  /**
   * Validates that an array has a minimum length
   */
  static hasMinLength<T>(array: T[], minLength: number): boolean {
    return Array.isArray(array) && array.length >= minLength;
  }

  /**
   * Validates that an array has a maximum length
   */
  static hasMaxLength<T>(array: T[], maxLength: number): boolean {
    return Array.isArray(array) && array.length <= maxLength;
  }

  /**
   * Validates that a value is within a numeric range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Validates that a date string is in YYYY-MM-DD format and represents a valid date
   */
  static isValidDateString(dateString: string): boolean {
    if (!dateString || typeof dateString !== "string") {
      return false;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    // Split the date string and validate ranges
    const [year, month, day] = dateString.split("-").map(Number);

    // Basic range checks
    if (month < 1 || month > 12) {
      return false;
    }

    if (day < 1 || day > 31) {
      return false;
    }

    // Create a date object and check if it's valid
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor

    // Check if the date is valid and matches the input
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }

    return !isNaN(date.getTime());
  }

  /**
   * Validates that a game mode is valid
   */
  static isValidGameMode(mode: unknown): mode is "daily" | "classic" {
    return typeof mode === "string" && ["daily", "classic"].includes(mode);
  }
}
