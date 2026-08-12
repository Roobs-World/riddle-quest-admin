import type {CallableOptions} from "firebase-functions/v2/https";

/** Hard upper bound used by the account-deletion operation lease. */
export const BROWSER_CALLABLE_TIMEOUT_SECONDS = 60;

/**
 * Fail-closed security options for every browser-facing callable.
 *
 * App Check is bypassed only by the local Firebase Functions emulator. There
 * is intentionally no production feature flag that can disable attestation.
 */
export const browserCallableSecurityOptions = Object.freeze({
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  invoker: "public",
  timeoutSeconds: BROWSER_CALLABLE_TIMEOUT_SECONDS,
} satisfies CallableOptions);
