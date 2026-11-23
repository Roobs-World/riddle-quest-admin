import {FieldValue, Timestamp, type Firestore} from "firebase-admin/firestore";

/** Fixed storage/write budget for one scheduled or operator page. */
export const REDDIT_PROFILE_RETENTION_PAGE_LIMIT = 50;
/** Firestore's largest representable millisecond timestamp. */
const TIMESTAMP_MAX_MS = 253402300799999;

/** Rejects invalid cutoffs before any selection or mutation. */
function requireClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > TIMESTAMP_MAX_MS) {
    throw new Error("invalid-reddit-profile-retention-clock");
  }
}

/** Revalidates an expired cache transactionally and removes only its nested profile field. */
export async function purgeExpiredRedditProfile(
  db: Firestore, providerKey: string, nowMs: number, apply = false,
): Promise<"ready" | "missing" | "absent" | "active" | "foreign"> {
  requireClock(nowMs);
  if (!/^[0-9a-f]{64}$/.test(providerKey)) throw new Error("invalid-reddit-profile-retention-key");
  /** A permanent provider mapping is never deleted, recreated or replaced. */
  const ref = db.doc(`providerIdentities/${providerKey}`);
  /** Exact Timestamp comparison preserves sub-millisecond expiry boundaries. */
  const cutoff = Timestamp.fromMillis(nowMs);
  return db.runTransaction(async transaction => {
    /** Stale selection cannot clear a concurrently refreshed profile or recreated mapping. */
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return "missing";
    /** Provider scope is checked again within the transaction, rather than trusted from a query. */
    const value = snapshot.data()!;
    if (value.provider !== "reddit") return "foreign";
    if (!("redditProfile" in value)) return "absent";
    /** Only a real provider timestamp can authorize physical cache removal. */
    const profile = value.redditProfile;
    if (typeof profile !== "object" || profile === null || Array.isArray(profile) || !(profile.expiresAt instanceof Timestamp)) {
      throw new Error("invalid-reddit-profile-retention-record");
    }
    /** The SDK bounds timestamp seconds/nanoseconds independently of floating-point conversion. */
    const expiry = profile.expiresAt as Timestamp;
    if (expiry.seconds > cutoff.seconds || expiry.seconds === cutoff.seconds && expiry.nanoseconds > cutoff.nanoseconds) {
      return "active";
    }
    if (apply) transaction.update(ref, {redditProfile: FieldValue.delete()});
    return "ready";
  });
}

/** Processes one indexed page without logging identities, profiles or raw provider diagnostics. */
export async function purgeExpiredRedditProfilePage(
  db: Firestore, nowMs: number, apply = false, limit = REDDIT_PROFILE_RETENTION_PAGE_LIMIT,
): Promise<{
  /** Candidate mappings inspected in transactions. */
  scanned: number;
  /** Expired fields eligible in dry run or removed in apply mode. */
  ready: number;
  /** Mappings concurrently deleted by ordinary operations. */
  missing: number;
  /** Profiles concurrently removed by deletion or another cleanup worker. */
  absent: number;
  /** Profiles renewed after the initial selection. */
  active: number;
  /** Mappings whose provider changed after selection. */
  foreign: number;
  /** Malformed state or failed transactions retained for operator investigation. */
  invalid: number;
  /** True only when the selected range has no further page or failed candidate. */
  complete: boolean;
}> {
  requireClock(nowMs);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > REDDIT_PROFILE_RETENTION_PAGE_LIMIT) {
    throw new Error("invalid-reddit-profile-retention-limit");
  }
  /** Provider equality and nested expiry use the committed composite index. */
  const snapshot = await db.collection("providerIdentities").where("provider", "==", "reddit")
    .where("redditProfile.expiresAt", "<=", Timestamp.fromMillis(nowMs))
    .orderBy("redditProfile.expiresAt").limit(limit + 1).get();
  /** Aggregate evidence never includes document keys or stored profile values. */
  const totals = {scanned: 0, ready: 0, missing: 0, absent: 0, active: 0, foreign: 0, invalid: 0};
  for (const row of snapshot.docs.slice(0, limit)) {
    totals.scanned++;
    try {
      /** The transaction re-reads current state before choosing one field-only update. */
      const status = await purgeExpiredRedditProfile(db, row.id, nowMs, apply);
      totals[status]++;
    } catch {
      totals.invalid++;
    }
  }
  return {...totals, complete: snapshot.size <= limit && totals.invalid === 0};
}
