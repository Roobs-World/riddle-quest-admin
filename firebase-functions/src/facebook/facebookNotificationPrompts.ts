import {getFirestore, Timestamp, type Firestore} from "firebase-admin/firestore";

/** Defines the facebook notification reprompt ms value. */
export const FACEBOOK_NOTIFICATION_REPROMPT_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the max firestore milliseconds value. */
const MAX_FIRESTORE_MILLISECONDS = 253_402_300_799_999;

/** Describes prompt lease. */
type PromptLease = Readonly<{
  schemaVersion: 1;
  uid: string;
  accepted: boolean;
  lastPromptAtMs: number;
  acceptedAtMs?: number;
}>;

/** Provides timestamp millis behavior. */
const timestampMillis = (value: unknown): number => {
  if (typeof value !== "object" || value === null || !("toMillis" in value) ||
    typeof (value as {toMillis?: unknown}).toMillis !== "function") {
    throw new Error("invalid-facebook-notification-prompt-lease");
  }
  try {
    const milliseconds = (value as {toMillis(): unknown}).toMillis();
    if (typeof milliseconds !== "number" || !Number.isSafeInteger(milliseconds) ||
      milliseconds < 0 || milliseconds > MAX_FIRESTORE_MILLISECONDS) throw new Error();
    return milliseconds;
  } catch {
    throw new Error("invalid-facebook-notification-prompt-lease");
  }
};

/** Parses lease. */
const parseLease = (value: unknown, uid: string): PromptLease | null => {
  if (value === undefined) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid-facebook-notification-prompt-lease");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || record.uid !== uid || typeof record.accepted !== "boolean") {
    throw new Error("invalid-facebook-notification-prompt-lease");
  }
  const lastPromptAtMs = timestampMillis(record.lastPromptAt);
  const acceptedAtMs = record.acceptedAt === undefined ? undefined : timestampMillis(record.acceptedAt);
  if ((record.accepted && acceptedAtMs === undefined) || (!record.accepted && acceptedAtMs !== undefined)) {
    throw new Error("invalid-facebook-notification-prompt-lease");
  }
  return {schemaVersion: 1, uid, accepted: record.accepted, lastPromptAtMs, ...(acceptedAtMs === undefined ? {} : {acceptedAtMs})};
};

/** Indicates whether has authoritative win. */
const hasAuthoritativeWin = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid-facebook-notification-win-state");
  }
  const stats = (value as Record<string, unknown>).stats;
  if (typeof stats !== "object" || stats === null || Array.isArray(stats)) {
    throw new Error("invalid-facebook-notification-win-state");
  }
  const record = stats as Record<string, unknown>;
  const counters = ["wins", "totalWins", "multiplayerWins"].map((field) => record[field] ?? 0);
  if (counters.some((counter) => typeof counter !== "number" || !Number.isSafeInteger(counter) || counter < 0)) {
    throw new Error("invalid-facebook-notification-win-state");
  }
  return counters.some((counter) => (counter as number) > 0);
};

/** Pure fail-closed decision used by the transactional prompt lease. */
export function resolveFacebookNotificationPromptClaim({
  uid,
  user,
  lease,
  nowMs,
}: {
  uid: string;
  user: unknown;
  lease: unknown;
  nowMs: number;
}): {granted: false} | {granted: true; claimedAtMs: number} {
  if (!/^facebook_[0-9a-f]{40}$/u.test(uid) || !Number.isSafeInteger(nowMs) ||
    nowMs < 0 || nowMs > MAX_FIRESTORE_MILLISECONDS) {
    throw new Error("invalid-facebook-notification-prompt-request");
  }
  if (!hasAuthoritativeWin(user)) return {granted: false};
  const parsedLease = parseLease(lease, uid);
  if (parsedLease?.accepted) return {granted: false};
  if (parsedLease && (parsedLease.lastPromptAtMs > nowMs ||
    nowMs - parsedLease.lastPromptAtMs < FACEBOOK_NOTIFICATION_REPROMPT_MS)) {
    return {granted: false};
  }
  return {granted: true, claimedAtMs: nowMs};
}

/** Atomically grants at most one prompt attempt per player per seven-day window. */
export async function claimFacebookNotificationPrompt(
  uid: string,
  {db = getFirestore(), nowMs = Date.now()}: {db?: Firestore; nowMs?: number} = {},
): Promise<{granted: false} | {granted: true; claimedAtMs: number}> {
  const userRef = db.collection("users").doc(uid);
  const leaseRef = db.collection("facebookNotificationPromptLeases").doc(uid);
  return db.runTransaction(async (transaction) => {
    const [userSnapshot, leaseSnapshot] = await Promise.all([
      transaction.get(userRef), transaction.get(leaseRef),
    ]);
    if (!userSnapshot.exists) throw new Error("facebook-notification-user-missing");
    const decision = resolveFacebookNotificationPromptClaim({
      uid,
      user: userSnapshot.data(),
      lease: leaseSnapshot.exists ? leaseSnapshot.data() : undefined,
      nowMs,
    });
    if (decision.granted) {
      transaction.set(leaseRef, {
        schemaVersion: 1,
        uid,
        accepted: false,
        lastPromptAt: Timestamp.fromMillis(decision.claimedAtMs),
      }, {merge: false});
    }
    return decision;
  });
}

/** Permanently records successful platform permission after a granted prompt attempt. */
export async function acceptFacebookNotificationPrompt(
  uid: string,
  {db = getFirestore(), nowMs = Date.now()}: {db?: Firestore; nowMs?: number} = {},
): Promise<void> {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > MAX_FIRESTORE_MILLISECONDS) {
    throw new Error("invalid-facebook-notification-prompt-request");
  }
  const leaseRef = db.collection("facebookNotificationPromptLeases").doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leaseRef);
    if (!snapshot.exists) throw new Error("facebook-notification-prompt-not-claimed");
    const lease = parseLease(snapshot.data(), uid);
    if (!lease) throw new Error("facebook-notification-prompt-not-claimed");
    if (lease.accepted) return;
    if (lease.lastPromptAtMs > nowMs) throw new Error("invalid-facebook-notification-prompt-lease");
    transaction.set(leaseRef, {
      schemaVersion: 1,
      uid,
      accepted: true,
      lastPromptAt: Timestamp.fromMillis(lease.lastPromptAtMs),
      acceptedAt: Timestamp.fromMillis(nowMs),
    }, {merge: false});
  });
}
