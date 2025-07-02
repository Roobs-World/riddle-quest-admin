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
      it("should create AppError with message and code", () => {
        const error = new AppError("Test error", "TEST_ERROR");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe("Test error");
        expect(error.code).toBe("TEST_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe("AppError");
      });

      it("should create AppError with custom status code", () => {
        const error = new AppError("Test error", "TEST_ERROR", 400);

        expect(error.statusCode).toBe(400);
      });

      it("should create AppError with default status code", () => {
        const error = new AppError("Test message", "TEST_CODE");

        expect(error.message).toBe("Test message");
        expect(error.code).toBe("TEST_CODE");
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe("AppError");
      });

      it("should have correct prototype chain", () => {
        const error = new AppError("Test", "TEST_CODE");
        expect(error instanceof Error).toBe(true);
        expect(error instanceof AppError).toBe(true);
      });
    });

    describe("ValidationError", () => {
      it("should create ValidationError with message", () => {
        const error = new ValidationError("Validation failed");

        expect(error.message).toBe("Validation failed");
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.name).toBe("ValidationError");
        expect(error).toBeInstanceOf(AppError);
      });

      it("should create ValidationError with custom message", () => {
        const error = new ValidationError("Custom validation message");

        expect(error.message).toBe("Custom validation message");
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.name).toBe("ValidationError");
      });
    });

    describe("NetworkError", () => {
      it("should create NetworkError with default message", () => {
        const error = new NetworkError();

        expect(error.message).toBe("Network request failed");
        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.statusCode).toBe(503);
        expect(error.name).toBe("NetworkError");
        expect(error).toBeInstanceOf(AppError);
      });

      it("should create NetworkError with custom message", () => {
        const error = new NetworkError("Custom network message");

        expect(error.message).toBe("Custom network message");
        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.statusCode).toBe(503);
        expect(error.name).toBe("NetworkError");
      });
    });

    describe("AuthenticationError", () => {
      it("should create AuthenticationError with default message", () => {
        const error = new AuthenticationError();

        expect(error.message).toBe("Authentication failed");
        expect(error.code).toBe("AUTH_ERROR");
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe("AuthenticationError");
        expect(error).toBeInstanceOf(AppError);
      });

      it("should create AuthenticationError with custom message", () => {
        const error = new AuthenticationError("Custom auth message");

        expect(error.message).toBe("Custom auth message");
        expect(error.code).toBe("AUTH_ERROR");
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe("AuthenticationError");
      });
    });

    describe("NotFoundError", () => {
      it("should create NotFoundError with default message", () => {
        const error = new NotFoundError();

        expect(error.message).toBe("Resource not found");
        expect(error.code).toBe("NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.name).toBe("NotFoundError");
        expect(error).toBeInstanceOf(AppError);
      });

      it("should create NotFoundError with custom message", () => {
        const error = new NotFoundError("Custom not found message");

        expect(error.message).toBe("Custom not found message");
        expect(error.code).toBe("NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.name).toBe("NotFoundError");
      });
    });
  });

  describe("ErrorUtils Static Methods", () => {
    describe("isFirebaseError", () => {
      it("should return true for Firebase-like errors", () => {
        const firebaseError = {
          code: "auth/user-not-found",
          message: "User not found",
        };

        expect(ErrorUtils.isFirebaseError(firebaseError)).toBe(true);
      });

      it("should return true for different Firebase error codes", () => {
        const authError = {
          code: "auth/wrong-password",
          message: "Wrong password",
        };
        const firestoreError = {
          code: "firestore/permission-denied",
          message: "Permission denied",
        };

        expect(ErrorUtils.isFirebaseError(authError)).toBe(true);
        expect(ErrorUtils.isFirebaseError(firestoreError)).toBe(true);
      });

      it("should return false for non-Firebase errors", () => {
        expect(ErrorUtils.isFirebaseError(new Error("Regular error"))).toBe(
          false
        );
        expect(ErrorUtils.isFirebaseError({ message: "No code" })).toBe(false);
        expect(ErrorUtils.isFirebaseError({ code: "No message" })).toBe(false);
        expect(ErrorUtils.isFirebaseError(null)).toBe(false);
        expect(ErrorUtils.isFirebaseError(undefined)).toBe(false);
        expect(ErrorUtils.isFirebaseError("string")).toBe(false);
        expect(ErrorUtils.isFirebaseError(123)).toBe(false);
      });

      it("should handle edge cases", () => {
        expect(ErrorUtils.isFirebaseError({})).toBe(false);
        expect(
          ErrorUtils.isFirebaseError({ code: null, message: "test" })
        ).toBe(false);
        expect(
          ErrorUtils.isFirebaseError({ code: "test", message: null })
        ).toBe(false);
        expect(ErrorUtils.isFirebaseError({ code: "", message: "" })).toBe(
          true
        ); // Empty strings are truthy for typeof check
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
