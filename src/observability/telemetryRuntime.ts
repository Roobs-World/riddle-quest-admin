import {firebaseEnvironment} from "../platform/firebase/browserEnvironment";
import {hasTrustedTestHarnessMarker} from "../app/testing/testHarness";

/**
 * Decides whether a browser runtime may send production telemetry.
 *
 * @param configuration Build mode, browser hostname, and trusted harness state.
 * @returns Whether remote production telemetry is allowed.
 */
export function shouldEnableBrowserTelemetry({
  production,
  hostname,
  trustedTestHarness,
}: {
  /** Stores production. */
  production: boolean;
  /** Stores hostname. */
  hostname: string | undefined;
  /** Stores trusted test harness. */
  trustedTestHarness: boolean;
}): boolean {
  if (!production || trustedTestHarness) return false;
  /** Normalizes d hostname. */
  const normalizedHostname = hostname?.trim().toLowerCase().replace(/\.$/, "");
  if (!normalizedHostname) return false;
  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname) ||
    /^\[?::ffff:127\./.test(normalizedHostname)
  )
    return false;
  return true;
}

/** Returns whether the current page is a remote production runtime outside a trusted test harness. */
export function isBrowserTelemetryRuntimeAllowed(): boolean {
  return shouldEnableBrowserTelemetry({
    production: firebaseEnvironment.production,
    hostname: typeof window === "undefined" ? undefined : window.location?.hostname,
    trustedTestHarness: hasTrustedTestHarnessMarker(),
  });
}
