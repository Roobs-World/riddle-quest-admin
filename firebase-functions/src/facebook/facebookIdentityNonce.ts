import {Timestamp, type Firestore} from "firebase-admin/firestore";

/** One-use Meta assertion challenge lifetime; logical validation does not wait for TTL. */
export const FACEBOOK_NONCE_TTL_MS = 5 * 60 * 1_000;
/** Firestore's timestamp ceiling also bounds all numeric authentication clocks. */
export const FACEBOOK_NONCE_TIMESTAMP_MAX_MS = 253_402_300_799_999;
/** Server-only collection, distinct from every other provider's identity state. */
export const FACEBOOK_NONCE_COLLECTION = "facebookIdentityNonces";

/** Minimal nonce state, with optional physical expiry during the legacy rollout. */
type FacebookNonceRecord = Readonly<{
  /** Original challenge issue time. */ createdAtMs: number;
  /** Fixed acceptance deadline; consumption never extends it. */ expiresAtMs: number;
  /** Exact Firestore TTL timestamp when prepared. */ expiresAt?: Timestamp;
  /** One-use receipt, or null before consumption. */ consumedAtMs: number | null;
  /** Purpose-scoped replay audit value present only after consumption. */ playerIdHash?: string;
}>;

/** Issues the exact numeric and physical five-minute deadline without an identity field. */
export function createFacebookIdentityNonceRecord(createdAtMs: number): FacebookNonceRecord {
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0 ||
    createdAtMs > FACEBOOK_NONCE_TIMESTAMP_MAX_MS - FACEBOOK_NONCE_TTL_MS) {
    throw new Error("invalid-facebook-nonce-clock");
  }
  return {createdAtMs, expiresAtMs: createdAtMs + FACEBOOK_NONCE_TTL_MS,
    expiresAt: Timestamp.fromMillis(createdAtMs + FACEBOOK_NONCE_TTL_MS), consumedAtMs: null};
}

/** Validates original/consumed state and rejects mismatched TTL instead of repairing its lifetime. */
export function readFacebookIdentityNonceRecord(value: unknown): FacebookNonceRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid-facebook-nonce-record");
  /** Only the server's minimal lifetime and replay metadata is accepted. */
  const row = value as Record<string, unknown>;
  /** Original five-minute window must remain valid even after consumption or physical expiry. */
  const {createdAtMs, expiresAtMs, consumedAtMs, expiresAt, playerIdHash} = row;
  if (Object.keys(row).some(key => !["createdAtMs", "expiresAtMs", "consumedAtMs", "expiresAt", "playerIdHash"].includes(key)) ||
    typeof createdAtMs !== "number" || !Number.isSafeInteger(createdAtMs) || createdAtMs < 0 ||
    createdAtMs > FACEBOOK_NONCE_TIMESTAMP_MAX_MS - FACEBOOK_NONCE_TTL_MS ||
    typeof expiresAtMs !== "number" || expiresAtMs !== createdAtMs + FACEBOOK_NONCE_TTL_MS ||
    (expiresAt !== undefined && (!(expiresAt instanceof Timestamp) || !expiresAt.isEqual(Timestamp.fromMillis(expiresAtMs)))) ||
    (consumedAtMs === null ? playerIdHash !== undefined :
      typeof consumedAtMs !== "number" || !Number.isSafeInteger(consumedAtMs) ||
      consumedAtMs < createdAtMs || consumedAtMs >= expiresAtMs ||
      typeof playerIdHash !== "string" || !/^[0-9a-f]{64}$/.test(playerIdHash))) {
    throw new Error("invalid-facebook-nonce-record");
  }
  return row as FacebookNonceRecord;
}

/** Prepares one legacy nonce transactionally; deletion/consumption can never recreate or renew it. */
export async function prepareFacebookIdentityNonceRetention(db: Firestore, nonceHash: string, apply = false): Promise<
  "ready" | "already-ready" | "missing"
> {
  if (!/^[0-9a-f]{64}$/.test(nonceHash)) throw new Error("invalid-facebook-nonce-hash");
  /** Opaque SHA-256 document scope contains no raw challenge or player identity. */
  const ref = db.collection(FACEBOOK_NONCE_COLLECTION).doc(nonceHash);
  return db.runTransaction(async transaction => {
    /** Re-read inside the transaction instead of writing the stale maintenance page. */
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return "missing";
    /** Both consumed and unused legacy rows retain their exact original acceptance deadline. */
    const record = readFacebookIdentityNonceRecord(snapshot.data());
    if (record.expiresAt !== undefined) return "already-ready";
    if (apply) transaction.update(ref, {expiresAt: Timestamp.fromMillis(record.expiresAtMs)});
    return "ready";
  });
}
