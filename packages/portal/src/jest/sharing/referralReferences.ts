import {createJestReferralShareReference, type JestPersonalizedReferralReference} from "@qwordly/core/referrals";

/** Per-page counter used only when Web Crypto is unavailable. */
let fallbackSequence = 0;

/** Creates a fixed-width opaque suffix without placing player or challenge data in telemetry. */
export function createJestReferralShareToken(
  fillRandom?: ((bytes: Uint8Array<ArrayBuffer>) => void) | null,
  now: () => number = Date.now,
): string {
  /** Provides bytes behavior. */
  const bytes = new Uint8Array(new ArrayBuffer(8));
  /** Provides secure fill behavior. */
  const secureFill =
    fillRandom === undefined
      ? typeof globalThis.crypto?.getRandomValues === "function"
        ? (target: Uint8Array<ArrayBuffer>) => {
            globalThis.crypto.getRandomValues(target);
          }
        : undefined
      : (fillRandom ?? undefined);
  if (secureFill) {
    secureFill(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Web Crypto is available in supported Jest browsers. This bounded fallback
  // preserves per-page uniqueness in older test/webview environments.
  fallbackSequence = (fallbackSequence + 1) & 0xffff;
  return `${now().toString(16).padStart(12, "0").slice(-12)}${fallbackSequence.toString(16).padStart(4, "0")}`;
}

/** Creates an immutable personalized Jest link reference for one share action. */
export function createUniqueJestReferralReference(
  kind: "result" | "race",
  token = createJestReferralShareToken(),
): JestPersonalizedReferralReference {
  return createJestReferralShareReference(kind, token);
}
