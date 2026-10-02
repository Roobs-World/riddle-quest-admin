import {createHash} from "node:crypto";
import type {ReportSocialRivalRequest} from "@qwordly/core/race";
import {resolveLiveRaceSafetyTarget} from "./liveRaceSafetyTarget";
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
  target: string | {
    /** Caller-owned opaque live seat. */
    liveTicketId: string;
  },
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
  if (typeof target === "string") validateIdentityPair(reporterId, target);
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  requireSafeTime(nowMs);
  /** The resolved private identity leaves the transaction only for presence revocation. */
  const targetUserId = await db.runTransaction(async (transaction) => {
    /** Live bindings and recorded relationships are authorized in the same write transaction. */
    const resolved = typeof target === "string" ? target : await resolveLiveRaceSafetyTarget(transaction, db, reporterId, target.liveTicketId, nowMs);
    validateIdentityPair(reporterId, resolved);
    if (typeof target === "string") requireKnownRival(await transaction.get(db.doc(`users/${reporterId}/knownRivals/${resolved}`)), resolved);
    transaction.set(db.doc(`users/${reporterId}/blockedRivals/${resolved}`), {targetUserId: resolved, blockedAtMs: nowMs}, {merge: false});
    return resolved;
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
  input: ReportSocialRivalRequest,
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
  if ("targetUserId" in input) validateIdentityPair(reporterId, input.targetUserId);
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
  /** Provides report ref behavior. */
  const reportRef = db.collection("socialModerationQueue").doc(reportId);
  /** Provides limit ref behavior. */
  const limitRef = db.collection("socialReportRateLimits").doc(opaqueId(reporterId, day));
  await db.runTransaction(async (transaction) => {
    /** Resolve a private live peer under the report transaction, or require an established recorded rival. */
    const targetUserId = "targetUserId" in input ? input.targetUserId : await resolveLiveRaceSafetyTarget(transaction, db, reporterId, input.liveTicketId, nowMs);
    validateIdentityPair(reporterId, targetUserId);
    if ("targetUserId" in input) requireKnownRival(await transaction.get(db.doc(`users/${reporterId}/knownRivals/${targetUserId}`)), targetUserId);
    /** Replay and quota are read before every write. */
    const [existing, limit] = await Promise.all([transaction.get(reportRef), transaction.get(limitRef)]);
    if (existing.exists) {
      /** Provides value behavior. */
      const value = existing.data();
      if (
        value?.reportId !== reportId ||
        value.reporterId !== reporterId ||
        value.targetUserId !== targetUserId ||
        value.category !== input.category ||
        value.liveTicketBinding !== ("liveTicketId" in input ? opaqueId("live-safety-v1", reporterId, input.liveTicketId) : undefined) ||
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
      targetUserId,
      category: input.category,
      status: "queued",
      ...("liveTicketId" in input ? {liveTicketBinding: opaqueId("live-safety-v1", reporterId, input.liveTicketId)} : {}),
      createdAtMs: nowMs,
    });
    transaction.set(limitRef, {reporterId, day, count: count + 1, updatedAtMs: nowMs}, {merge: false});
  });
  return {reportId, queued: true};
}
