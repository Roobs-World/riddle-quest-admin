import type {CallableOptions} from "firebase-functions/v2/https";

/**
 * Fail-closed security options for every browser-facing callable.
 *
 * App Check is bypassed only by the local Firebase Functions emulator. There
 * is intentionally no production feature flag that can disable attestation.
 */
export const browserCallableSecurityOptions = Object.freeze({
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  invoker: "public",
} satisfies CallableOptions);
