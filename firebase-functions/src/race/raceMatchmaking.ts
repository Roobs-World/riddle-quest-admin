import {createHash, randomUUID} from "node:crypto";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceMatchResponseSchema, RACE_RULES_VERSION, type RaceMatchRequest, type RaceMatchResponse} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {raceChallengeEligibility, raceProviderScope, type RaceEligibilityReason} from "./raceEligibility";
import {challengePreview, parseChallengeRecord, requestDocumentId, type Firestore} from "./raceSetupService";

/** Maximum indexed candidate page size per lookup. */
export const RACE_MATCH_PAGE_SIZE = 50;
/** Maximum candidate pages examined in a single lookup. */
export const RACE_MATCH_MAX_PAGES = 4;
/** Short offer lifetime; a ghost remains reusable by other players. */
export const RACE_MATCH_OFFER_MS = 60_000;

/** Reads one canonical eligible challenge; infrastructure errors are never classified as an empty pool. */
async function readEligibleChallenge(db: Firestore, userId: string, challengeId: string, input: RaceMatchRequest, nowMs: number) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(db.doc(`raceChallenges/${challengeId}`));
    if (!snapshot.exists) return {reason: "inactive" as RaceEligibilityReason};
    let challenge;
    try {challenge = parseChallengeRecord(snapshot.data());}
    catch (error) {
      if (error instanceof HttpsError && ["data-loss", "internal"].includes(error.code)) return {reason: "content" as RaceEligibilityReason};
      throw error;
    }
    if (input.categoryId && challenge.categoryId !== input.categoryId) return {reason: "content" as RaceEligibilityReason};
    const reason = await raceChallengeEligibility(transaction, db, userId, challenge, input.locale, nowMs);
    return reason ? {reason} : {challenge};
  });
}

/**
 * Selects an eligible recorded race within the authenticated provider pool.
 * Offers are stable across retries, scoped to the requester, and never lock a
 * reusable recording. Both offer creation and race acceptance revalidate state.
 */
export async function findRecordedRaceMatch(
  userId: string,
  input: RaceMatchRequest,
  options: {/** Storage seam for emulated concurrency tests. */ db?: Firestore; /** Authoritative request time. */ nowMs?: number} = {},
): Promise<RaceMatchResponse> {
  const provider = raceProviderScope(userId);
  if (!provider) throw new HttpsError("permission-denied", "Recorded matchmaking requires a provider identity.");
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  const started = Date.now();
  const requestId = input.requestId ?? randomUUID();
  const receipt = db.doc(`raceMatchOffers/${requestDocumentId(userId, requestId)}`);
  const fingerprint = JSON.stringify({locale: input.locale, categoryId: input.categoryId ?? null});
  const previous = await receipt.get();
  if (previous.exists && previous.data()?.fingerprint !== fingerprint) throw new HttpsError("invalid-argument", "Match request was reused for different preferences.");
  if (previous.data()?.expiresAtMs > nowMs) {
    const replay = await readEligibleChallenge(db, userId, previous.data()!.challengeId, input, nowMs);
    if (replay.challenge) return RaceMatchResponseSchema.parse({status: "matched", challenge: challengePreview(replay.challenge, nowMs)});
  }
  const rejected: Partial<Record<RaceEligibilityReason, number>> = {};
  let examined = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (let page = 0; page < RACE_MATCH_MAX_PAGES; page += 1) {
    let query = db.collection("raceMatchCandidates").where("provider", "==", provider)
      .where("locale", "==", input.locale).where("rulesVersion", "==", RACE_RULES_VERSION)
      .where("status", "==", "active").where("expiresAtMs", ">", nowMs)
      .orderBy("expiresAtMs").orderBy(admin.firestore.FieldPath.documentId()).limit(RACE_MATCH_PAGE_SIZE);
    if (input.categoryId) query = query.where("categoryId", "==", input.categoryId);
    if (cursor) query = query.startAfter(cursor);
    const candidates = await query.get();
    // Retry-stable variation avoids always returning the earliest-expiring ghost.
    const ordered = [...candidates.docs].sort((left, right) => {
      const hash = (id: string) => createHash("sha256").update(`${requestId}:${id}`).digest("hex");
      return hash(left.id).localeCompare(hash(right.id));
    });
    for (const candidate of ordered) {
      examined += 1;
      const result = await readEligibleChallenge(db, userId, candidate.id, input, nowMs);
      if (!result.challenge) {
        const reason = result.reason ?? "content";
        rejected[reason] = (rejected[reason] ?? 0) + 1;
        continue;
      }
      const offered = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(receipt);
        if (existing.exists && existing.data()?.fingerprint !== fingerprint) throw new HttpsError("invalid-argument", "Match preferences changed.");
        let challengeId = candidate.id;
        const previousId = existing.data()?.expiresAtMs > nowMs ? existing.data()!.challengeId : undefined;
        if (typeof previousId === "string") {
          const previousSnapshot = await transaction.get(db.doc(`raceChallenges/${previousId}`));
          if (previousSnapshot.exists) {
            const previousChallenge = parseChallengeRecord(previousSnapshot.data());
            if (!await raceChallengeEligibility(transaction, db, userId, previousChallenge, input.locale, nowMs)) challengeId = previousId;
          }
        }
        const snapshot = await transaction.get(db.doc(`raceChallenges/${challengeId}`));
        if (!snapshot.exists) return null;
        const challenge = parseChallengeRecord(snapshot.data());
        if (input.categoryId && challenge.categoryId !== input.categoryId) return null;
        if (await raceChallengeEligibility(transaction, db, userId, challenge, input.locale, nowMs)) return null;
        const expiresAtMs = challengeId === previousId ? existing.data()!.expiresAtMs : Math.min(nowMs + RACE_MATCH_OFFER_MS, challenge.expiresAtMs);
        transaction.set(receipt, {userId, fingerprint, challengeId, expiresAtMs, expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs)});
        return challengePreview(challenge, nowMs);
      });
      if (!offered) continue;
      logger.info("Race matchmaking lookup", {provider, locale: input.locale, examined, rejected, matched: true, durationMs: Date.now() - started});
      return RaceMatchResponseSchema.parse({status: "matched", challenge: offered});
    }
    if (candidates.size < RACE_MATCH_PAGE_SIZE) {
      logger.info("Race matchmaking lookup", {provider, locale: input.locale, examined, rejected, matched: false, durationMs: Date.now() - started});
      return RaceMatchResponseSchema.parse({status: "empty", locale: input.locale});
    }
    cursor = candidates.docs.at(-1);
  }
  throw new HttpsError("resource-exhausted", "Match search reached its bounded candidate budget. Please retry.");
}
