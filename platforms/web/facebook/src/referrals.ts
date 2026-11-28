import type {FacebookInstantSdk} from "./fbinstant";

/** Defines the token pattern value. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Opaque invitation receipt issued by the authenticated game server. */
export interface FacebookReferralToken {
  /** Token included in Meta entry data. */
  token: string;
  /** Server expiry in Unix milliseconds. */
  expiresAtMs: number;
}

/** Reads bounded launch hints; the race server still authorizes the referenced challenge. */
export function facebookLaunchFromEntryData(value: unknown): {
  /** Target single-player mode. */
  initialGameMode: "classic" | "challenge";
  /** Opaque published race reference, never a client-supplied score or opponent identity. */
  initialRaceChallengeId?: string;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {initialGameMode: "classic"};
  /** Untrusted provider entry envelope. */
  const entry = value as Record<string, unknown>;
  if (entry.kind === "rq-race10-tournament-v1") {
    // Retired tournament links cannot select a challenge or open a tournament surface.
    return {initialGameMode: "classic"};
  }
  return {
    initialGameMode: entry.gameMode === "challenge" ? "challenge" : "classic",
    ...(typeof entry.challengeId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(entry.challengeId)
      ? {initialRaceChallengeId: entry.challengeId} : {}),
  };
}

/** Issues a fresh server-owned token without exposing the authenticated Firebase identity. */
export async function createFacebookReferralToken(): Promise<FacebookReferralToken> {
  /** Firebase remains confined to the Facebook target's authenticated authority. */
  const [{getFunctions}, {firebaseApp}, {encryptedHttpsCallable: httpsCallable}] = await Promise.all([
    import("firebase/functions"), import("../../../../src/platform/firebase/browserClient"),
    import("../../../../src/platform/firebase/encryptedCallable"),
  ]);
  /** Token response is validated before entering the provider share payload. */
  const result = await httpsCallable<Record<string, never>, unknown>(
    getFunctions(firebaseApp, "us-central1"), "createFacebookReferral",
  )({});
  return parseFacebookReferralTokenResponse(result.data);
}

/** Rejects malformed or expired server responses before opening a native share dialog. */
export function parseFacebookReferralTokenResponse(value: unknown, nowMs = Date.now()): FacebookReferralToken {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("facebook-referral-response-invalid");
  /** Only the opaque token and expiry are accepted from the callable response. */
  const record = value as Record<string, unknown>;
  if (typeof record.token !== "string" || !TOKEN_PATTERN.test(record.token) ||
    typeof record.expiresAtMs !== "number" || !Number.isSafeInteger(record.expiresAtMs) || record.expiresAtMs <= nowMs)
    throw new Error("facebook-referral-response-invalid");
  return {token: record.token, expiresAtMs: record.expiresAtMs};
}

/** Extracts only the opaque game token; all other untrusted entry data is ignored. */
export function facebookReferralTokenFromEntryData(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  /** Provides token behavior. */
  const token = (value as Record<string, unknown>).referralToken;
  return typeof token === "string" && TOKEN_PATTERN.test(token) ? token : undefined;
}

/** Binds an entry referral after Firebase auth and custom App Check are established. */
export async function bindFacebookEntryReferral(sdk: FacebookInstantSdk): Promise<boolean> {
  /** Provides token behavior. */
  const token = facebookReferralTokenFromEntryData(sdk.getEntryPointData?.());
  if (!token) return false;
  /** Provides [{get functions, https callable}, {firebase app}] behavior. */
  const [{getFunctions}, {firebaseApp}, {encryptedHttpsCallable: httpsCallable}] = await Promise.all([
    import("firebase/functions"),
    import("../../../../src/platform/firebase/browserClient"),
    import("../../../../src/platform/firebase/encryptedCallable"),
  ]);
  /** Provides bind behavior. */
  const bind = httpsCallable<
    {
      /** Stores token. */
      token: string;
    },
    {
      /** Stores already bound. */
      alreadyBound: boolean;
    }
  >(getFunctions(firebaseApp, "us-central1"), "bindFacebookReferral");
  await bind({token});
  return true;
}
