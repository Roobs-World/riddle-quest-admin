/** Defines keys whose values must never leave the browser in telemetry. */
const sensitiveFieldPattern = /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|secret|token|uid|userId)/i;

/** Matches bearer credentials embedded in otherwise harmless strings. */
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Matches compact three-part credentials such as JWTs. */
const compactTokenPattern = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;

/** Matches base64 image payloads that may contain a player's avatar. */
const dataImagePattern = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

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
    return value
      .replace(bearerPattern, "Bearer [REDACTED]")
      .replace(compactTokenPattern, "[REDACTED_TOKEN]")
      .replace(dataImagePattern, "[REDACTED_IMAGE]");
  }
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
