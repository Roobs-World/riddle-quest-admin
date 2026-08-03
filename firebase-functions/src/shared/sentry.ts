/**
 * Thin wrapper around @sentry/node for Firebase Functions.
 *
 * Initialises Sentry only when SENTRY_DSN is set in the environment so
 * functions work safely without Sentry configured. All exported helpers
 * are no-ops when the DSN is absent.
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
type SpanAttributes = Record<string, string | number | boolean | undefined>;

const sensitiveFieldPattern = /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|secret|token|uid|userId)/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const compactTokenPattern = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;
const dataImagePattern = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

/**
 * Removes credentials, player identifiers, guesses, and answer material from
 * telemetry objects before they can leave the trusted backend.
 *
 * @param value Arbitrary telemetry value.
 * @param depth Current recursion depth used to bound hostile/cyclic objects.
 * @param seen Objects already visited during recursion.
 * @returns A telemetry-safe copy of the value.
 */
export function redactSensitiveTelemetry(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") {
    return value
      .replace(bearerPattern, "Bearer [REDACTED]")
      .replace(compactTokenPattern, "[REDACTED_TOKEN]")
      .replace(dataImagePattern, "[REDACTED_IMAGE]");
  }
  if (value === null || typeof value !== "object" || depth >= 8) return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveTelemetry(item, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveFieldPattern.test(key) ? "[REDACTED]" : redactSensitiveTelemetry(entry, depth + 1, seen),
    ]),
  );
}

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: (event) => redactSensitiveTelemetry(event) as typeof event,
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
      scope.setExtras(redactSensitiveTelemetry(context) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function withSentrySpan<T>(name: string, op: string, callback: () => T, attributes?: SpanAttributes): T {
  if (!dsn) return callback();
  return Sentry.startSpan({name, op, attributes}, callback);
}
