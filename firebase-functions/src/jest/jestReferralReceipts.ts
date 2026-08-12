import {createHash} from "node:crypto";
import {
  JEST_REFERRAL_REFERENCES,
  isJestRewardedReferralReference,
  type JestReferralReference,
} from "@qwordly/core/referrals";

/** Maximum platform player-ID bytes accepted from a signed referral snapshot. */
const MAX_REFERRAL_PLAYER_ID_BYTES = 512;
/** Maximum ISO timestamp bytes accepted from a signed referral conversion. */
const MAX_REFERRAL_JOINED_AT_BYTES = 64;
/** Maximum referral grants committed by one verification request. */
const MAX_REFERRAL_GRANTS_PER_INVOCATION = 20;
/** Maximum reward receipts read in one pre-transaction scan page. */
const REFERRAL_RECEIPT_SCAN_BATCH_SIZE = 100;

/** A validated conversion entry from Jest-signed referral data. */
interface SignedReferralConversion {
  /** Platform identity of the referred player. */
  playerId: string;
  /** Platform-reported registration timestamp. */
  joinedAt: string;
}

/** One validated, reward-eligible Jest referral conversion. */
export interface JestReferralConversion extends SignedReferralConversion {
  /** Strict backend-approved campaign or personalized share reference. */
  reference: JestReferralReference;
}

/** Returns whether an unknown value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Returns whether an unknown string fits a fixed UTF-8 byte budget. */
const isBoundedString = (value: unknown, maxBytes: number): value is string =>
  typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maxBytes;

/** Validates one signed referral conversion entry. */
const isReferralConversion = (value: unknown): value is SignedReferralConversion =>
  isRecord(value) &&
  isBoundedString(value.playerId, MAX_REFERRAL_PLAYER_ID_BYTES) &&
  isBoundedString(value.joinedAt, MAX_REFERRAL_JOINED_AT_BYTES) &&
  !Number.isNaN(Date.parse(value.joinedAt));

/** Creates the one bounded latest-verification document ID owned by a Jest player. */
export function createJestReferralVerificationId(playerId: string): string {
  return createHash("sha256").update(`jest-referral-verification-v1:${playerId}`).digest("hex");
}

/** Creates the campaign-independent inviter/invitee reward tombstone ID. */
export function createJestReferralRewardId(inviterPlayerId: string, referredPlayerId: string): string {
  return createHash("sha256")
    .update(`${inviterPlayerId}:${JEST_REFERRAL_REFERENCES.friendChallenge}:${referredPlayerId}`)
    .digest("hex");
}

/** Selects reward-eligible unique conversions from one verified signed payload. */
export function selectReferralConversions(
  payload: Record<string, unknown>,
  inviterPlayerId: string,
): JestReferralConversion[] {
  const referrals = isRecord(payload.referrals) ? payload.referrals : {};
  const conversions = Object.entries(referrals).flatMap(([reference, entries]) =>
    isJestRewardedReferralReference(reference) && Array.isArray(entries)
      ? entries.filter(isReferralConversion).map((entry) => ({...entry, reference}))
      : [],
  );
  return [...new Map(
    conversions
      .filter((entry) => entry.playerId !== inviterPlayerId)
      .map((entry) => [entry.playerId, entry]),
  ).values()];
}

/**
 * Selects up to twenty conversions whose deterministic reward receipts do not exist.
 *
 * Receipt reads run outside the grant transaction in bounded pages. The caller
 * must reread returned candidates inside its transaction before granting them.
 */
export async function selectUngrantedReferralConversions(
  conversions: readonly JestReferralConversion[],
  readReceiptStates: (batch: readonly JestReferralConversion[]) => Promise<readonly boolean[]>,
): Promise<JestReferralConversion[]> {
  const selected: JestReferralConversion[] = [];
  for (let offset = 0; offset < conversions.length; offset += REFERRAL_RECEIPT_SCAN_BATCH_SIZE) {
    const batch = conversions.slice(offset, offset + REFERRAL_RECEIPT_SCAN_BATCH_SIZE);
    const receiptStates = await readReceiptStates(batch);
    if (receiptStates.length !== batch.length) throw new Error("invalid-referral-receipt-scan");
    for (let index = 0; index < batch.length; index += 1) {
      if (!receiptStates[index]) selected.push(batch[index]);
      if (selected.length === MAX_REFERRAL_GRANTS_PER_INVOCATION) return selected;
    }
  }
  return selected;
}
