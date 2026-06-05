import {ZodError} from "zod";
import {t} from "../i18n";
import {ValidationUtils} from "./validationUtils";
import {logger} from "./logger";
import {captureException} from "./sentry";
import {
  ErrorMessageResolver,
  createCodeMapStrategy,
  extractErrorCode,
  extractErrorMessage,
} from "./errorResolution";

/**
 * Custom error types for the application
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: string[],
  ) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string = t("ErrorMessages.NETWORK_REQUEST_FAILED")) {
    super(message, "NETWORK_ERROR", 503);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = t("ErrorMessages.AUTHENTICATION_FAILED")) {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = t("ErrorMessages.RESOURCE_NOT_FOUND")) {
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
  static isFirebaseError(error: unknown): error is {code: string; message: string} {
    return typeof extractErrorCode(error) === "string" && typeof extractErrorMessage(error) === "string";
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
    return this.errorMessageResolver.resolve(error);
  }

  private static readonly errorMessageResolver = new ErrorMessageResolver(
    [
      {
        name: "AppError",
        matches: (error: unknown): boolean => error instanceof AppError,
        resolve: (error: unknown): string | null => (error instanceof AppError ? error.message : null),
      },
      {
        name: "ZodError",
        matches: (error: unknown): boolean => error instanceof ZodError,
        resolve: () => t("ErrorMessages.INVALID_DATA_FORMAT"),
      },
      createCodeMapStrategy(
        "FirebaseAuthAndBackend",
        {
          "auth/user-not-found": t("ErrorMessages.NO_ACCOUNT_FOUND_WITH_EMAIL"),
          "auth/wrong-password": t("ErrorMessages.WRONG_PASSWORD_TRY_AGAIN"),
          "auth/email-already-in-use": t("ErrorMessages.ACCOUNT_WITH_EMAIL_EXISTS"),
          "auth/weak-password": t("ErrorMessages.PASSWORD_MIN_LENGTH_AUTH"),
          "auth/invalid-email": t("ErrorMessages.PLEASE_ENTER_VALID_EMAIL"),
          "auth/network-request-failed": t("ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION"),
          "auth/too-many-requests": t("ErrorMessages.TOO_MANY_FAILED_ATTEMPTS"),
          "firestore/permission-denied": t("ErrorMessages.PERMISSION_DENIED_ACTION"),
          "firestore/unavailable": t("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"),
          "functions/not-found": t("ErrorMessages.RESOURCE_NOT_FOUND"),
          "functions/permission-denied": t("ErrorMessages.PERMISSION_DENIED_FUNCTION"),
          "functions/unauthenticated": t("ErrorMessages.SIGN_IN_TO_CONTINUE"),
        },
        {
          normalizeCode: (code: string) => code.trim().toLowerCase(),
        },
      ),
      {
        name: "MessageFallback",
        matches: (error: unknown): boolean =>
          typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
        resolve: () => null,
      },
      {
        name: "GenericError",
        matches: (error: unknown): boolean => error instanceof Error,
        resolve: () => null,
      },
    ],
    {
      fallbackMessage: t("ErrorMessages.GENERIC_UNEXPECTED_ERROR"),
    },
  );

  /**
   * Logs an error with appropriate detail level
   */
  static logError(error: unknown, context?: string): void {
    const prefix = context ? `[${context}]` : "";
    captureException(error, context ? {context} : undefined);

    if (error instanceof AppError) {
      logger.error(`${prefix} AppError:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    } else if (this.isZodError(error)) {
      logger.error(`${prefix} Validation Error:`, ValidationUtils.formatZodError(error));
    } else if (this.isFirebaseError(error)) {
      logger.error(`${prefix} Firebase Error:`, {
        code: error.code,
        message: error.message,
      });
    } else if (error instanceof Error) {
      logger.error(`${prefix} Error:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      logger.error(`${prefix} Unknown Error:`, error);
    }
  }

  /**
   * Creates a standardized error response
   */
  static createErrorResponse(
    error: unknown,
    context?: string,
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
        code: this.isFirebaseError(error) ? error.code : error instanceof AppError ? error.code : undefined,
        details: this.isZodError(error) ? error.issues : undefined,
      },
    };
  }

  /**
   * Wraps an async function with error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: string,
  ): Promise<{success: true; data: T} | {success: false; error: unknown}> {
    try {
      const data = await fn();
      return {success: true, data};
    } catch (error) {
      return this.createErrorResponse(error, context);
    }
  }
}

// Export helper functions for easier usage
export const isFirebaseError = ErrorUtils.isFirebaseError;
export const isZodError = ErrorUtils.isZodError;
