/**
 * Thin wrapper around @sentry/node for Firebase Functions.
 *
 * Initialises Sentry only when SENTRY_DSN is set in the environment so
 * functions work safely without Sentry configured. All exported helpers
 * are no-ops when the DSN is absent.
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  });
}

/**
 * Captures an exception and sends it to Sentry (no-op if DSN not configured).
 *
 * @param error   - Any caught value (Error, string, unknown).
 * @param context - Optional key/value pairs attached as extra context.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
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
