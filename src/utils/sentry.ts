/**
 * Thin wrapper around @sentry/react-native.
 *
 * Initialises Sentry only when EXPO_PUBLIC_SENTRY_DSN is set so the app
 * works safely without Sentry configured. All exported helpers are no-ops
 * when the DSN is absent.
 */
import * as Sentry from "@sentry/react-native";
import type {Event, EventHint} from "@sentry/core";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
type SpanAttributes = Record<string, string | number | boolean | undefined>;

const isDevelopmentRuntime = (): boolean => {
  if (typeof __DEV__ !== "undefined") {
    return __DEV__;
  }
  return process.env.NODE_ENV !== "production";
};

const normalizeUnknownText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const maybeError = value as Record<string, unknown>;
  const parts = ["name", "code", "message", "type", "value"]
    .map((key) => maybeError[key])
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

  if (maybeError.cause) {
    parts.push(normalizeUnknownText(maybeError.cause));
  }

  return parts.length > 0 ? parts.join(" ") : String(value);
};

const eventToText = (event: Event): string => {
  const exceptionValues = event.exception?.values ?? [];
  const exceptionText = exceptionValues
    .flatMap((exception) => [exception.type, exception.value])
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

  return [
    event.message,
    event.logentry?.message,
    event.environment,
    event.transaction,
    ...exceptionText,
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .join(" ");
};

const isExpectedSentryNoise = (text: string, isDevelopment: boolean): boolean => {
  const lowerText = text.toLowerCase();

  if (!lowerText.trim()) {
    return false;
  }

  if (
    lowerText.includes("google sign-in cancelled by user") ||
    lowerText.includes("sign_in_cancelled") ||
    lowerText.includes("user cancelled the login process") ||
    lowerText.includes("user cancelled the login flow") ||
    lowerText.includes("facebook login cancelled") ||
    lowerText.includes("auth/auth-popup-closed-by-user")
  ) {
    return true;
  }

  if (lowerText.includes("googlemobileads/no-fill") || lowerText.includes("[googlemobileads/no-fill]")) {
    return true;
  }

  if (
    lowerText.includes("expoasset.downloadasync") ||
    lowerText.includes("unable to download asset from url: http://10.0.2.2:8081")
  ) {
    return true;
  }

  if (
    lowerText.includes("failed to initialize connection") &&
    (lowerText.includes("purchaseerror") || lowerText.includes("react-native-iap"))
  ) {
    return true;
  }

  if (!isDevelopment) {
    return false;
  }

  return (
    lowerText.includes("tried to register two views with the same name") ||
    lowerText.includes('requiring unknown module "react-native"') ||
    lowerText.includes("operation timed out after 15000ms")
  );
};

export const shouldDropSentryEvent = (event: Event, hint?: EventHint): boolean => {
  const eventText = eventToText(event);
  const hintText = normalizeUnknownText(hint?.originalException);
  const isDevelopmentEvent = event.environment === "development" || isDevelopmentRuntime();
  return isExpectedSentryNoise(`${eventText} ${hintText}`, isDevelopmentEvent);
};

export const shouldDropCapturedException = (error: unknown): boolean =>
  isExpectedSentryNoise(normalizeUnknownText(error), isDevelopmentRuntime());

if (dsn) {
  Sentry.init({
    dsn,
    environment: isDevelopmentRuntime() ? "development" : "production",
    // Capture 100 % of transactions in dev; tune in production.
    tracesSampleRate: 1.0,
    beforeSend: (event, hint) => (shouldDropSentryEvent(event, hint) ? null : event),
  });
}

/**
 * Captures an exception and sends it to Sentry (no-op if DSN not configured).
 *
 * @param error - Any caught value (Error, string, unknown).
 * @param context - Optional key/value pairs attached as extra context.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  if (shouldDropCapturedException(error)) return;
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Captures a plain message and sends it to Sentry (no-op if DSN not configured).
 *
 * @param message - Human-readable message.
 * @param level   - Sentry severity level (defaults to "info").
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!dsn) return;
  Sentry.captureMessage(message, level);
}

/**
 * Sets the authenticated user on the current Sentry scope so that all
 * subsequent events are associated with this user in the dashboard.
 *
 * Call after a successful login / auth state change.
 *
 * @param id       - Firebase Auth UID (required).
 * @param email    - User email address (optional).
 * @param username - Display username (optional).
 */
export function setUser(id: string, email?: string | null, username?: string | null): void {
  if (!dsn) return;
  Sentry.setUser({
    id,
    ...(email ? {email} : {}),
    ...(username ? {username} : {}),
  });
}

/**
 * Clears the current user from the Sentry scope.
 *
 * Call after logout so subsequent anonymous events are not attributed to the
 * previous user.
 */
export function clearUser(): void {
  if (!dsn) return;
  Sentry.setUser(null);
}

/**
 * Adds a breadcrumb to the current Sentry scope.
 *
 * Breadcrumbs appear in the "Breadcrumbs" section of a Sentry issue and give
 * context about what the user was doing before the error occurred.
 *
 * @param category - Dot-separated category string (e.g. "game", "iap", "auth").
 * @param message  - Human-readable description of the action.
 * @param data     - Optional key/value pairs with additional context.
 * @param level    - Severity level (defaults to "info").
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: "debug" | "info" | "warning" | "error" = "info",
): void {
  if (!dsn) return;
  Sentry.addBreadcrumb({category, message, data, level});
}

export function withSentrySpan<T>(
  name: string,
  op: string,
  callback: () => T,
  attributes?: SpanAttributes,
): T {
  if (!dsn) return callback();
  return Sentry.startSpan({name, op, attributes}, callback);
}

/**
 * Starts a Sentry performance transaction.
 *
 * Use this to measure the duration of critical user-facing operations such as
 * guess submission or IAP validation.
 *
 * @param name - Human-readable transaction name shown in Sentry Performance.
 * @param op   - Operation type (e.g. "http.client", "db", "ui.action").
 * @returns    A transaction object with a `finish()` method. Call `finish()`
 *             when the measured operation completes.
 */
export function startTransaction(name: string, op: string): {finish: () => void} {
  if (!dsn) return {finish: () => {}};
  const transaction = Sentry.startInactiveSpan({name, op});
  return {
    finish: () => {
      transaction?.end();
    },
  };
}
