import {ANDROID_PACKAGE_NAME} from "./androidPlayCatalog";
import {createMetadataAccessToken} from "./playDeveloperApi";

/** OAuth scope required to decode integrity tokens. */
const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";
/** Longest age of a verdict the backend accepts. */
export const MAX_VERDICT_AGE_MS = 2 * 60 * 1_000;

/** Fields the backend reads from a decoded Play Integrity verdict. */
export type IntegrityVerdict = {
  /** Request the token was issued for. */
  requestDetails?: {
    /** Package that requested the token. */
    requestPackageName?: string;
    /** Nonce the app supplied. */
    nonce?: string;
    /** Issue time in epoch milliseconds, as a string. */
    timestampMillis?: string;
  };
  /** Whether the binary is the one Play distributes. */
  appIntegrity?: {
    /** `PLAY_RECOGNIZED` for genuine Play builds. */
    appRecognitionVerdict?: string;
    /** Package of the binary. */
    packageName?: string;
  };
  /** Whether the device is a genuine Android device. */
  deviceIntegrity?: {
    /** Includes `MEETS_DEVICE_INTEGRITY` for genuine devices. */
    deviceRecognitionVerdict?: string[];
  };
};

/** Decodes one integrity token with Google's servers. */
export type PlayIntegrityDecoder = (integrityToken: string) => Promise<IntegrityVerdict>;

/** Creates the decoder for the app's package, authenticated as the runtime service account. */
export function createPlayIntegrityDecoder(
  options: {packageName?: string; fetch?: typeof fetch; getAccessToken?: () => Promise<string>} = {},
): PlayIntegrityDecoder {
  /** HTTP transport. */
  const fetchImpl = options.fetch ?? fetch;
  /** Token source. */
  const getAccessToken = options.getAccessToken ?? createMetadataAccessToken(fetchImpl, PLAY_INTEGRITY_SCOPE);
  /** Decode endpoint for the package. */
  const url = `https://playintegrity.googleapis.com/v1/${encodeURIComponent(options.packageName ?? ANDROID_PACKAGE_NAME)}:decodeIntegrityToken`;
  return async (integrityToken) => {
    /** Google's response. */
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {"Authorization": `Bearer ${await getAccessToken()}`, "Content-Type": "application/json"},
      body: JSON.stringify({integrity_token: integrityToken}),
    });
    if (!response.ok) throw new Error("integrity-decode-failed");
    /** Decoded payload. */
    const body = (await response.json()) as {tokenPayloadExternal?: IntegrityVerdict};
    if (!body.tokenPayloadExternal) throw new Error("integrity-decode-failed");
    return body.tokenPayloadExternal;
  };
}

/**
 * Returns why a verdict is unacceptable, or `null` when it proves a genuine Play build on a genuine device.
 *
 * @remarks
 * The verdict must be for this package, carry the nonce the server issued, be
 * recent, come from the binary Play distributes, and come from a device that
 * meets device integrity. Each failure has a stable reason for logs.
 */
export function rejectIntegrityVerdict(
  verdict: IntegrityVerdict,
  expected: {nonce: string; now: number; packageName?: string},
): string | null {
  /** Expected package. */
  const packageName = expected.packageName ?? ANDROID_PACKAGE_NAME;
  if (verdict.requestDetails?.requestPackageName !== packageName) return "package-mismatch";
  if (verdict.requestDetails?.nonce !== expected.nonce) return "nonce-mismatch";
  /** Verdict issue time. */
  const issuedAt = Number(verdict.requestDetails?.timestampMillis);
  if (!Number.isFinite(issuedAt) || issuedAt > expected.now + 60_000 || expected.now - issuedAt > MAX_VERDICT_AGE_MS) return "verdict-stale";
  if (verdict.appIntegrity?.appRecognitionVerdict !== "PLAY_RECOGNIZED" || verdict.appIntegrity.packageName !== packageName) {
    return "app-not-recognized";
  }
  if (!verdict.deviceIntegrity?.deviceRecognitionVerdict?.includes("MEETS_DEVICE_INTEGRITY")) return "device-not-trusted";
  return null;
}
