/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the error utilities to test
import {
  AppError,
  ValidationError,
  NetworkError,
  AuthenticationError,
  NotFoundError,
  ErrorUtils,
  isFirebaseError,
  isZodError,
} from "../errorUtils";

// Import ZodError for testing
import { z } from "zod";

describe("Error Utils", () => {
  describe("Custom Error Classes", () => {
    describe("AppError", () => {
      test("should create AppError with message and code", () => {
        const error = new AppError("Test error", "TEST_ERROR");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe("Test error");
        expect(error.code).toBe("TEST_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe("AppError");
      });

      test("should create AppError with custom status code", () => {
        const error = new AppError("Test error", "TEST_ERROR", 400);

        expect(error.statusCode).toBe(400);
      });
    });

    describe("ValidationError", () => {
      test("should create ValidationError with details", () => {
        const details = ["Field is required", "Invalid format"];
        const error = new ValidationError("Validation failed", details);

        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe("Validation failed");
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual(details);
        expect(error.name).toBe("ValidationError");
      });

      test("should create ValidationError without details", () => {
        const error = new ValidationError("Validation failed");

        expect(error.details).toBeUndefined();
      });
    });

    describe("NetworkError", () => {
      test("should create NetworkError with custom message", () => {
        const error = new NetworkError("Network timeout");

        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe("Network timeout");
        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.statusCode).toBe(503);
        expect(error.name).toBe("NetworkError");
      });

      test("should create NetworkError with default message", () => {
        const error = new NetworkError();

        expect(error.message).toBe("Network request failed");
      });
    });

    describe("AuthenticationError", () => {
      test("should create AuthenticationError with custom message", () => {
        const error = new AuthenticationError("Invalid credentials");

        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe("Invalid credentials");
        expect(error.code).toBe("AUTH_ERROR");
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe("AuthenticationError");
      });

      test("should create AuthenticationError with default message", () => {
        const error = new AuthenticationError();

        expect(error.message).toBe("Authentication failed");
      });
    });

    describe("NotFoundError", () => {
      test("should create NotFoundError with custom message", () => {
        const error = new NotFoundError("User not found");

        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(NotFoundError);
        expect(error.message).toBe("User not found");
        expect(error.code).toBe("NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.name).toBe("NotFoundError");
      });

      test("should create NotFoundError with default message", () => {
        const error = new NotFoundError();

        expect(error.message).toBe("Resource not found");
      });
    });
  });

  describe("ErrorUtils Static Methods", () => {
    describe("isFirebaseError", () => {
      test("should detect Firebase error objects", () => {
        const firebaseError = {
          code: "auth/user-not-found",
          message: "User not found",
        };

        expect(ErrorUtils.isFirebaseError(firebaseError)).toBe(true);
        expect(isFirebaseError(firebaseError)).toBe(true);
      });

      test("should detect Firebase error objects with different codes", () => {
        const firebaseErrors = [
          { code: "firestore/permission-denied", message: "Permission denied" },
          { code: "storage/unauthorized", message: "Unauthorized" },
          { code: "functions/unauthenticated", message: "Unauthenticated" },
        ];

        firebaseErrors.forEach((error) => {
          expect(ErrorUtils.isFirebaseError(error)).toBe(true);
        });
      });

      test("should not detect non-Firebase errors", () => {
        const nonFirebaseErrors = [
          { message: "Regular error" },
          { code: "REGULAR_ERROR" }, // Missing message
          { message: "No code" }, // Missing code
          new Error("Standard error"),
          "string error",
          null,
          undefined,
          123,
        ];

        nonFirebaseErrors.forEach((error) => {
          expect(ErrorUtils.isFirebaseError(error)).toBe(false);
        });
      });

      test("should handle edge cases for Firebase detection", () => {
        expect(ErrorUtils.isFirebaseError({})).toBe(false);
        expect(ErrorUtils.isFirebaseError({ code: "" })).toBe(false);
        expect(ErrorUtils.isFirebaseError({ code: null })).toBe(false);
        expect(ErrorUtils.isFirebaseError({ code: 123 })).toBe(false);
      });
    });

    describe("isZodError", () => {
      test("should detect ZodError instances", () => {
        const schema = z.object({ email: z.string().email() });

        try {
          schema.parse({ email: "invalid-email" });
        } catch (error) {
          expect(ErrorUtils.isZodError(error)).toBe(true);
          expect(isZodError(error)).toBe(true);
        }
      });

      test("should not detect non-ZodError instances", () => {
        const nonZodErrors = [
          new Error("Regular error"),
          new AppError("App error", "APP_ERROR"),
          { message: "Object error" },
          "string error",
          null,
          undefined,
        ];

        nonZodErrors.forEach((error) => {
          expect(ErrorUtils.isZodError(error)).toBe(false);
        });
      });
    });

    describe("isNetworkError", () => {
      test("should detect NetworkError instances", () => {
        const networkError = new NetworkError("Connection failed");

        expect(ErrorUtils.isNetworkError(networkError)).toBe(true);
      });

      test("should detect Firebase network errors", () => {
        const firebaseNetworkErrors = [
          { code: "auth/network-request-failed", message: "Network failed" },
          { code: "firestore/timeout", message: "Timeout occurred" },
          { code: "functions/network-error", message: "Network error" },
        ];

        firebaseNetworkErrors.forEach((error) => {
          expect(ErrorUtils.isNetworkError(error)).toBe(true);
        });
      });

      test("should not detect non-network errors", () => {
        const nonNetworkErrors = [
          new AppError("App error", "APP_ERROR"),
          { code: "auth/user-not-found", message: "User not found" },
          new Error("Regular error"),
          "string error",
        ];

        nonNetworkErrors.forEach((error) => {
          expect(ErrorUtils.isNetworkError(error)).toBe(false);
        });
      });
    });

    describe("isAuthError", () => {
      test("should detect AuthenticationError instances", () => {
        const authError = new AuthenticationError("Invalid token");

        expect(ErrorUtils.isAuthError(authError)).toBe(true);
      });

      test("should detect Firebase auth errors", () => {
        const firebaseAuthErrors = [
          { code: "auth/user-not-found", message: "User not found" },
          { code: "firestore/permission-denied", message: "Permission denied" },
          { code: "functions/unauthenticated", message: "Unauthenticated" },
        ];

        firebaseAuthErrors.forEach((error) => {
          expect(ErrorUtils.isAuthError(error)).toBe(true);
        });
      });

      test("should not detect non-auth errors", () => {
        const nonAuthErrors = [
          new NetworkError("Network failed"),
          { code: "validation/invalid-format", message: "Invalid format" },
          new Error("Regular error"),
          "string error",
        ];

        nonAuthErrors.forEach((error) => {
          expect(ErrorUtils.isAuthError(error)).toBe(false);
        });
      });
    });

    describe("getUserFriendlyMessage", () => {
      test("should return AppError message", () => {
        const error = new AppError("Custom app error", "APP_ERROR");

        expect(ErrorUtils.getUserFriendlyMessage(error)).toBe(
          "Custom app error"
        );
      });

      test("should return Zod error message", () => {
        const schema = z.object({ email: z.string().email() });

        try {
          schema.parse({ email: "invalid" });
        } catch (error) {
          const message = ErrorUtils.getUserFriendlyMessage(error);
          expect(message).toBe("Invalid data format. Please check your input.");
        }
      });

      test("should return Firebase error messages", () => {
        const firebaseErrors = [
          {
            code: "auth/user-not-found",
            message: "User not found",
            expected: "No account found with this email address.",
          },
          {
            code: "auth/wrong-password",
            message: "Wrong password",
            expected: "Incorrect password. Please try again.",
          },
          {
            code: "unknown/error",
            message: "Unknown error",
            expected: "Unknown error",
          },
        ];

        firebaseErrors.forEach(({ code, message, expected }) => {
          const error = { code, message };
          expect(ErrorUtils.getUserFriendlyMessage(error)).toBe(expected);
        });
      });

      test("should return standard Error message", () => {
        const error = new Error("Standard error message");

        expect(ErrorUtils.getUserFriendlyMessage(error)).toBe(
          "Standard error message"
        );
      });

      test("should return default message for unknown errors", () => {
        const unknownErrors = ["string error", 123, null, undefined, {}];

        unknownErrors.forEach((error) => {
          expect(ErrorUtils.getUserFriendlyMessage(error)).toBe(
            "An unexpected error occurred. Please try again."
          );
        });
      });
    });

    describe("logError", () => {
      // Mock console methods for testing
      const originalConsoleError = console.error;

      beforeEach(() => {
        console.error = jest.fn();
      });

      afterEach(() => {
        console.error = originalConsoleError;
      });

      test("should log AppError with details", () => {
        const error = new AppError("Test error", "TEST_ERROR", 400);

        ErrorUtils.logError(error, "TEST_CONTEXT");

        expect(console.error).toHaveBeenCalledWith("[TEST_CONTEXT] AppError:", {
          name: "AppError",
          message: "Test error",
          code: "TEST_ERROR",
          statusCode: 400,
        });
      });

      test("should log Firebase error", () => {
        const error = {
          code: "auth/user-not-found",
          message: "User not found",
        };

        ErrorUtils.logError(error);

        expect(console.error).toHaveBeenCalledWith(" Firebase Error:", {
          code: "auth/user-not-found",
          message: "User not found",
        });
      });

      test("should log standard Error", () => {
        const error = new Error("Standard error");

        ErrorUtils.logError(error);

        expect(console.error).toHaveBeenCalledWith(
          " Error:",
          expect.objectContaining({
            name: "Error",
            message: "Standard error",
            stack: expect.any(String),
          })
        );
      });

      test("should log unknown error", () => {
        const error = "string error";

        ErrorUtils.logError(error);

        expect(console.error).toHaveBeenCalledWith(
          " Unknown Error:",
          "string error"
        );
      });
    });

    describe("createErrorResponse", () => {
      // Mock console methods for testing
      const originalConsoleError = console.error;

      beforeEach(() => {
        console.error = jest.fn();
      });

      afterEach(() => {
        console.error = originalConsoleError;
      });

      test("should create error response for AppError", () => {
        const error = new AppError("Test error", "TEST_ERROR");
        const response = ErrorUtils.createErrorResponse(error, "TEST_CONTEXT");

        expect(response).toEqual({
          success: false,
          error: {
            message: "Test error",
            code: "TEST_ERROR",
            details: undefined,
          },
        });

        expect(console.error).toHaveBeenCalled();
      });

      test("should create error response for Firebase error", () => {
        const error = {
          code: "auth/user-not-found",
          message: "User not found",
        };
        const response = ErrorUtils.createErrorResponse(error);

        expect(response).toEqual({
          success: false,
          error: {
            message: "No account found with this email address.",
            code: "auth/user-not-found",
            details: undefined,
          },
        });
      });

      test("should create error response for Zod error", () => {
        const schema = z.object({ email: z.string().email() });

        try {
          schema.parse({ email: "invalid" });
        } catch (zodError) {
          const response = ErrorUtils.createErrorResponse(zodError);

          expect(response.success).toBe(false);
          expect(response.error.message).toBe(
            "Invalid data format. Please check your input."
          );
          expect(response.error.details).toBeDefined();
        }
      });
    });

    describe("withErrorHandling", () => {
      test("should return success result for successful function", async () => {
        const successfulFunction = async () => "success result";
        const result = await ErrorUtils.withErrorHandling(successfulFunction);

        expect(result).toEqual({
          success: true,
          data: "success result",
        });
      });

      test("should return error result for failing function", async () => {
        // Mock console methods for testing
        const originalConsoleError = console.error;
        console.error = jest.fn();

        try {
          const failingFunction = async () => {
            throw new AppError("Async error", "ASYNC_ERROR");
          };
          const result = await ErrorUtils.withErrorHandling(
            failingFunction,
            "ASYNC_CONTEXT"
          );

          expect(result.success).toBe(false);
          if (!result.success) {
            expect((result.error as any).message).toBe("Async error");
          }

          expect(console.error).toHaveBeenCalled();
        } finally {
          console.error = originalConsoleError;
        }
      });
    });
  });

  describe("Integration Tests", () => {
    test("should work together in error handling flow", () => {
      const originalError = new ValidationError("Invalid email format", [
        "email must be valid",
      ]);

      // Test error detection
      expect(ErrorUtils.isNetworkError(originalError)).toBe(false);
      expect(ErrorUtils.isAuthError(originalError)).toBe(false);

      // Test message extraction
      const message = ErrorUtils.getUserFriendlyMessage(originalError);
      expect(message).toBe("Invalid email format");
    });

    test("should handle complex Firebase error scenarios", () => {
      const firebaseError = {
        code: "firestore/permission-denied",
        message: "Missing or insufficient permissions",
      };

      // Test Firebase detection
      expect(ErrorUtils.isFirebaseError(firebaseError)).toBe(true);
      expect(ErrorUtils.isAuthError(firebaseError)).toBe(true);
      expect(ErrorUtils.isNetworkError(firebaseError)).toBe(false);

      // Test user-friendly message
      const friendlyMessage = ErrorUtils.getUserFriendlyMessage(firebaseError);
      expect(friendlyMessage).toBe(
        "You do not have permission to perform this action."
      );
    });
  });
});
