/** Referral state exposes no Google subject or durable replay key. */
export type AndroidReferralStatus =
  | Readonly<{
      /** Discriminates whether Google verification is required or referral state is available. */
      kind: "google-required";
    }>
  | Readonly<{
      /** Discriminates whether Google verification is required or referral state is available. */
      kind: "ready";
      /** Whether this durable Google subject is still eligible for first-acquisition binding. */
      canBind: boolean;
      /** Whether this Google subject has already selected its lifetime referrer. */
      bound: boolean;
      /** Whether a qualifying first-win reward has already been recorded. */
      settled: boolean;
      /** Server-owned award offered by the referral program. */
      rewardCoins: number;
    }>;
/** Opaque server-issued referral entry. */
export type AndroidReferralToken = Readonly<{
  /** Opaque provider token, never a local grant or account selector. */
  token: string;
  /** Server-owned expiration of the opaque entry or notification. */
  expiresAtMs: number;
  /** Server-owned award offered by the referral program. */
  rewardCoins: number;
}>;
/** One immutable acquisition binding, with no client-owned reward. */
export type AndroidReferralBinding = Readonly<{
  /** Indicates an idempotent replay of the same immutable acquisition binding. */
  alreadyBound: boolean;
  /** Server-owned expiration of the opaque entry or notification. */
  expiresAtMs: number;
}>;
/** Android-only authenticated referral functions. */
export type AndroidReferralBackend = Readonly<{
  /** Reads current server eligibility without accepting an invitation. */
  status(expectedOwnerId?: string): Promise<AndroidReferralStatus>;
  /** Issues a bounded, expiring referral token at the authenticated server. */
  create(expectedOwnerId?: string): Promise<AndroidReferralToken>;
  /** Explicitly accepts one server token before authoritative play or purchases. */
  bind(token: string, expectedOwnerId?: string): Promise<AndroidReferralBinding>;
}>;
/** Shares only a validated opaque referral handle; successful sharing is never conversion evidence. */
export function androidReferralUrl(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("android-referral-token-invalid");
  return `riddlequest://referral?token=${token}`;
}
/** Native entry data can select a token but cannot select an inviter or an award. */
export function parseAndroidReferralUrl(url: string): string | null {
  return /^riddlequest:\/\/referral\?token=([A-Za-z0-9_-]{43})$/.exec(url)?.[1] ?? null;
}
