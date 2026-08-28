import {createHash} from "node:crypto";
import type {Database} from "firebase-admin/database";
import {HttpsError} from "firebase-functions/v2/https";
import {refreshBlockedRivalPresenceVisibility} from "../presence/presenceVisibility";
import {admin} from "../shared/firebaseAdmin";

/** Defines the social report categories value. */
export const SOCIAL_REPORT_CATEGORIES = ["harassment", "cheating", "inappropriate_identity", "spam", "other"] as const;
/** Describes social report category. */
export type SocialReportCategory = (typeof SOCIAL_REPORT_CATEGORIES)[number];
/** Defines the social report daily limit value. */
export const SOCIAL_REPORT_DAILY_LIMIT = 5;
/** Defines the max date ms value. */
const MAX_DATE_MS = 8_640_000_000_000_000;
/** Defines the known rival sources value. */
const KNOWN_RIVAL_SOURCES = new Set(["completed_race", "facebook_context", "facebook_invite"]);

/** Provides require safe time behavior. */
const requireSafeTime = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DATE_MS) {
    throw new HttpsError("invalid-argument", "Social safety time is invalid.");
  }
};

/** Validates identity pair. */
const validateIdentityPair = (reporterId: string, targetUserId: string): void => {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(reporterId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(targetUserId) ||
    reporterId === targetUserId
  ) {
    throw new HttpsError("invalid-argument", "Social safety identity pair is invalid.");
  }
};

/** Provides require known rival behavior. */
const requireKnownRival = (snapshot: FirebaseFirestore.DocumentSnapshot, targetUserId: string): void => {
  /** Provides value behavior. */
  const value = snapshot.data();
  if (
    !snapshot.exists ||
    value?.targetUserId !== targetUserId ||
    typeof value.source !== "string" ||
    !KNOWN_RIVAL_SOURCES.has(value.source) ||
    !Number.isSafeInteger(value.establishedAtMs) ||
    value.establishedAtMs < 0 ||
    value.establishedAtMs > MAX_DATE_MS
  ) {
    throw new HttpsError("permission-denied", "Only a valid known rival can be targeted.");
  }
};

/** Provides opaque id behavior. */
const opaqueId = (...parts: string[]): string => createHash("sha256").update(parts.join("\0"), "utf8").digest("hex");
/** Provides utc day behavior. */
const utcDay = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 10);

/** Creates or refreshes a bilateral block after confirming an established rivalry. */
export async function blockKnownRival(
  reporterId: string,
  targetUserId: string,
  options: {
    /** Stores db. */
    db?: FirebaseFirestore.Firestore; /** Stores database. */
    /** Stores database. */
    database?: Database; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores blocked. */
  blocked: true;
}> {
  validateIdentityPair(reporterId, targetUserId);
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  requireSafeTime(nowMs);
  /** Provides known ref behavior. */
  const knownRef = db.doc(`users/${reporterId}/knownRivals/${targetUserId}`);
  /** Provides block ref behavior. */
  const blockRef = db.doc(`users/${reporterId}/blockedRivals/${targetUserId}`);
  await db.runTransaction(async (transaction) => {
    /** Provides known behavior. */
    const known = await transaction.get(knownRef);
    requireKnownRival(known, targetUserId);
    transaction.set(blockRef, {targetUserId, blockedAtMs: nowMs}, {merge: false});
  });
  // Do not report a successful block while an existing RTDB ACL can still
  // expose either player's presence. The Firestore trigger repeats this work
  // as reconciliation if the callable loses its response after this point.
  await refreshBlockedRivalPresenceVisibility(reporterId, targetUserId, db, options.database);
  return {blocked: true};
}

/** Queues one idempotent categorized report, capped per reporter and UTC day. */
export async function reportKnownRival(
  reporterId: string,
  input: {
    /** Stores target user id. */
    targetUserId: string; /** Stores category. */
    /** Stores category. */
    category: SocialReportCategory; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  },
  options: {
    /** Stores db. */
    db?: FirebaseFirestore.Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores report id. */
  reportId: string; /** Stores queued. */
  /** Stores queued. */
  queued: true;
}> {
  validateIdentityPair(reporterId, input.targetUserId);
  if (!(SOCIAL_REPORT_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new HttpsError("invalid-argument", "Social report category is invalid.");
  }
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestId)) {
    throw new HttpsError("invalid-argument", "Social report request ID is invalid.");
  }
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  requireSafeTime(nowMs);
  /** Provides day behavior. */
  const day = utcDay(nowMs);
  /** Provides report id behavior. */
  const reportId = opaqueId("social-report-v1", reporterId, input.requestId);
  /** Provides known ref behavior. */
  const knownRef = db.doc(`users/${reporterId}/knownRivals/${input.targetUserId}`);
  /** Provides report ref behavior. */
  const reportRef = db.collection("socialModerationQueue").doc(reportId);
  /** Provides limit ref behavior. */
  const limitRef = db.collection("socialReportRateLimits").doc(opaqueId(reporterId, day));
  await db.runTransaction(async (transaction) => {
    /** Provides [known, existing, limit] behavior. */
    const [known, existing, limit] = await Promise.all([
      transaction.get(knownRef),
      transaction.get(reportRef),
      transaction.get(limitRef),
    ]);
    requireKnownRival(known, input.targetUserId);
    if (existing.exists) {
      /** Provides value behavior. */
      const value = existing.data();
      if (
        value?.reportId !== reportId ||
        value.reporterId !== reporterId ||
        value.targetUserId !== input.targetUserId ||
        value.category !== input.category ||
        value.status !== "queued" ||
        !Number.isSafeInteger(value.createdAtMs) ||
        value.createdAtMs < 0 ||
        value.createdAtMs > MAX_DATE_MS
      ) {
        throw new HttpsError("failed-precondition", "Social report idempotency scope changed.");
      }
      return;
    }
    /** Provides limit value behavior. */
    const limitValue = limit.data();
    if (
      limit.exists &&
      (limitValue?.reporterId !== reporterId ||
        limitValue.day !== day ||
        !Number.isSafeInteger(limitValue.count) ||
        limitValue.count < 1 ||
        limitValue.count > SOCIAL_REPORT_DAILY_LIMIT ||
        !Number.isSafeInteger(limitValue.updatedAtMs) ||
        limitValue.updatedAtMs < 0 ||
        limitValue.updatedAtMs > MAX_DATE_MS)
    ) {
      throw new HttpsError("data-loss", "Social report rate limit is invalid.");
    }
    /** Provides count behavior. */
    const count = limit.exists ? Number(limitValue!.count) : 0;
    if (count >= SOCIAL_REPORT_DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily social report limit reached.");
    }
    transaction.create(reportRef, {
      reportId,
      reporterId,
      targetUserId: input.targetUserId,
      category: input.category,
      status: "queued",
      createdAtMs: nowMs,
    });
    transaction.set(limitRef, {reporterId, day, count: count + 1, updatedAtMs: nowMs}, {merge: false});
  });
  return {reportId, queued: true};
}
