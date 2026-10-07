/** App Check failures whose structured status can explain attestation throttling. */
const diagnosticCodes = new Set([
  "appCheck/initial-throttle",
  "appCheck/throttled",
  "appCheck/fetch-status-error",
]);

/**
 * Extracts only known App Check codes and numeric HTTP statuses. Never copies
 * messages, tokens, URLs, or arbitrary Firebase custom data into telemetry.
 *
 * @param error Original exception supplied by Sentry, including automatic captures.
 * @returns Bounded diagnostics, or an empty object for unrelated exceptions.
 */
export function appCheckDiagnostics(error: unknown): Record<string, string | number> {
  try {
    if (!error || typeof error !== "object" || !("code" in error)) return {};
    /** Untrusted SDK code checked against the finite allowlist. */
    const code = error.code;
    if (typeof code !== "string" || !diagnosticCodes.has(code)) return {};
    /** Only these bounded fields may survive message redaction. */
    const diagnostics: Record<string, string | number> = {appCheckErrorCode: code};
    /** SDK metadata inspected without serializing the object. */
    const data = "customData" in error ? error.customData : undefined;
    /** Original exchange status retained by Firebase during its cooldown. */
    const status = data && typeof data === "object" && "httpStatus" in data ? data.httpStatus : undefined;
    if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) {
      diagnostics.appCheckHttpStatus = status;
    }
    return diagnostics;
  } catch {
    // Error reporting must also tolerate rejected proxies and throwing getters.
    return {};
  }
}
