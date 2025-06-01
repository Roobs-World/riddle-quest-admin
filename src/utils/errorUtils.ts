import { ZodError } from "zod";
import { ValidationUtils } from "./validationUtils";

/**
 * Custom error types for the application
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: string[]) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string = "Network request failed") {
    super(message, "NETWORK_ERROR", 503);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Checks if an error is a Firebase error
   */
  static isFirebaseError(
    error: unknown
  ): error is { code: string; message: string } {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      typeof (error as { message: unknown }).message === "string"
    );
  }

  /**
   * Checks if an error is a Zod validation error
   */
  static isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError;
  }

  /**
   * Checks if an error is a network error
   */
  static isNetworkError(error: unknown): boolean {
    if (error instanceof NetworkError) {
      return true;
    }

    if (this.isFirebaseError(error)) {
      return error.code.includes("network") || error.code.includes("timeout");
    }

    return false;
  }

  /**
   * Checks if an error is an authentication error
   */
  static isAuthError(error: unknown): boolean {
    if (error instanceof AuthenticationError) {
      return true;
    }

    if (this.isFirebaseError(error)) {
      return error.code.includes("auth") || error.code.includes("permission");
    }

    return false;
  }

  /**
   * Extracts a user-friendly error message from any error
   */
  static getUserFriendlyMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (this.isZodError(error)) {
      return "Invalid data format. Please check your input.";
    }

    if (this.isFirebaseError(error)) {
      return this.getFirebaseErrorMessage(error);
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "An unexpected error occurred. Please try again.";
  }

  /**
   * Gets a user-friendly message for Firebase errors
   */
  private static getFirebaseErrorMessage(error: {
    code: string;
    message: string;
  }): string {
    const errorMappings: Record<string, string> = {
      "auth/user-not-found": "No account found with this email address.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password should be at least 6 characters long.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/network-request-failed":
        "Network error. Please check your connection.",
      "auth/too-many-requests":
        "Too many failed attempts. Please try again later.",
      "firestore/permission-denied":
        "You do not have permission to perform this action.",
      "firestore/unavailable":
        "Service temporarily unavailable. Please try again.",
      "functions/not-found": "The requested function was not found.",
      "functions/permission-denied":
        "You do not have permission to call this function.",
      "functions/unauthenticated": "Please sign in to continue.",
    };

    return (
      errorMappings[error.code] ||
      error.message ||
      "An error occurred. Please try again."
    );
  }

  /**
   * Logs an error with appropriate detail level
   */
  static logError(error: unknown, context?: string): void {
    const prefix = context ? `[${context}]` : "";

    if (error instanceof AppError) {
      console.error(`${prefix} AppError:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    } else if (this.isZodError(error)) {
      console.error(
        `${prefix} Validation Error:`,
        ValidationUtils.formatZodError(error)
      );
    } else if (this.isFirebaseError(error)) {
      console.error(`${prefix} Firebase Error:`, {
        code: error.code,
        message: error.message,
      });
    } else if (error instanceof Error) {
      console.error(`${prefix} Error:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error(`${prefix} Unknown Error:`, error);
    }
  }

  /**
   * Creates a standardized error response
   */
  static createErrorResponse(
    error: unknown,
    context?: string
  ): {
    success: false;
    error: {
      message: string;
      code?: string;
      details?: unknown;
    };
  } {
    this.logError(error, context);

    return {
      success: false,
      error: {
        message: this.getUserFriendlyMessage(error),
        code: this.isFirebaseError(error)
          ? error.code
          : error instanceof AppError
          ? error.code
          : undefined,
        details: this.isZodError(error) ? error.issues : undefined,
      },
    };
  }

  /**
   * Wraps an async function with error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<{ success: true; data: T } | { success: false; error: unknown }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return this.createErrorResponse(error, context);
    }
  }
}

// Export helper functions for easier usage
export const isFirebaseError = ErrorUtils.isFirebaseError;
export const isZodError = ErrorUtils.isZodError;
