/** Defines keys whose values must never leave the browser in telemetry. */
const sensitiveFieldPattern = /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|secret|token|uid|userId)/i;

/** Matches bearer credentials embedded in otherwise harmless strings. */
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Matches compact three-part credentials such as JWTs. */
const compactTokenPattern = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;

/** Matches base64 image payloads that may contain a player's avatar. */
const dataImagePattern = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

/** Removes query strings and fragments from URLs embedded in diagnostic text. */
const redactUrlDetails = (value: string): string => value.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
  try {
    const parsed = new URL(match);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "[REDACTED_URL]";
  }
});

/**
 * Validates that an optional browser telemetry DSN uses encrypted transport.
 *
 * @param value Configured browser DSN, if telemetry is enabled.
 * @returns The normalized HTTPS DSN or `undefined` when telemetry is disabled.
 * @throws When a configured DSN is malformed or uses plaintext transport.
 */
export function resolveSecureBrowserSentryDsn(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("VITE_SENTRY_DSN must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("VITE_SENTRY_DSN must use HTTPS.");
  return parsed.toString();
}

/**
 * Removes credentials, identity, guesses, answers, and image data from browser telemetry.
 *
 * @param value Arbitrary telemetry data.
 * @param depth Current recursion depth used to bound hostile objects.
 * @param seen Objects already visited during recursion.
 * @returns A telemetry-safe copy of the supplied value.
 */
export function redactBrowserTelemetry(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") {
    return redactUrlDetails(value
      .replace(bearerPattern, "Bearer [REDACTED]")
      .replace(compactTokenPattern, "[REDACTED_TOKEN]")
      .replace(dataImagePattern, "[REDACTED_IMAGE]"));
  }
  if (value instanceof URL) return redactUrlDetails(value.toString());
  if (value === null || typeof value !== "object" || depth >= 8) return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactBrowserTelemetry(item, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveFieldPattern.test(key) ? "[REDACTED]" : redactBrowserTelemetry(entry, depth + 1, seen),
    ]),
  );
}

/**
 * Applies stricter redaction to the free-form message fields used by Sentry.
 * Stack frames and structured, allowlisted context remain available for
 * debugging, but an exception or console message cannot echo a guess, answer,
 * player name, or backend response into telemetry.
 */
export function redactBrowserSentryEvent<T>(event: T): T {
  const redacted = redactBrowserTelemetry(event) as Record<string, unknown>;
  if (!redacted || typeof redacted !== "object") return redacted as T;

  // These fields can be populated by SDK defaults independently of the
  // application's explicit, already-redacted diagnostic extras. They are not
  // required for errors-only reporting and may contain player or request data.
  delete redacted.user;
  delete redacted.request;
  delete redacted.contexts;
  delete redacted.breadcrumbs;

  if (typeof redacted.message === "string") redacted.message = "[REDACTED_MESSAGE]";
  const logentry = redacted.logentry;
  if (logentry && typeof logentry === "object") {
    const safeLogentry = logentry as Record<string, unknown>;
    if (typeof safeLogentry.message === "string") safeLogentry.message = "[REDACTED_MESSAGE]";
    if (typeof safeLogentry.formatted === "string") safeLogentry.formatted = "[REDACTED_MESSAGE]";
  }
  const exception = redacted.exception;
  if (exception && typeof exception === "object") {
    const values = (exception as {values?: unknown}).values;
    if (Array.isArray(values)) {
      for (const value of values) {
        if (value && typeof value === "object" && typeof (value as {value?: unknown}).value === "string") {
          (value as {value: string}).value = "[REDACTED_MESSAGE]";
        }
      }
    }
  }
  return redacted as T;
}
