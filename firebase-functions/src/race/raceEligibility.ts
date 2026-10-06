import {assertRaceDeckCompatible} from "./raceDeckCompatibility";
import type {RaceRiddleSnapshot} from "./raceEngine";
import {parseRaceInvitation} from "./raceInvitationRecord";
import {HttpsError} from "firebase-functions/v2/https";
import {JestAccountDeletedError, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {validateRaceDeckSnapshot, assertRaceCreatorArchiveLink} from "./raceDeckSnapshot";
import {requestDocumentId, parseRunRecord, type Firestore, type RaceChallengeRecord} from "./raceSetupService";

/** Provider scope derived exclusively from an authenticated game-owned identity. */
export type RaceProviderScope = "jest" | "facebook" | "reddit";
/** Stable expected rejection reasons; storage failures propagate separately. */
export type RaceEligibilityReason = "self" | "provider" | "locale" | "inactive" | "deleted" | "blocked" | "attempted" | "invitation" | "content";

/** Identifies a validated provider namespace without trusting client-supplied scope. */
export function raceProviderScope(userId: string): RaceProviderScope | undefined {
  /** Provides match behavior. */
  const match = /^(jest|facebook|reddit)_[a-f0-9]{40}$/.exec(userId);
  return match?.[1] as RaceProviderScope | undefined;
}

/**
 * Reads discovery and acceptance eligibility through the same transaction seam.
 * Caller must first read the canonical challenge in this transaction. All checks
 * are side-effect-free; accepting callers retain their own attempt-creation write.
 */
export async function raceChallengeEligibility(
  transaction: FirebaseFirestore.Transaction, db: Firestore, userId: string,
  challenge: RaceChallengeRecord, locale: RaceChallengeRecord["locale"], nowMs: number, acceptedRunId?: string,
): Promise<RaceEligibilityReason | null> {
  return (await inspectRaceChallengeEligibility(transaction, db, userId, challenge, locale, nowMs, acceptedRunId)).reason;
}

/** Returns the authorized canonical archive from the same transaction as its eligibility checks. */
export async function inspectRaceChallengeEligibility(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  userId: string,
  challenge: RaceChallengeRecord,
  locale: RaceChallengeRecord["locale"],
  nowMs: number,
  acceptedRunId?: string,
): Promise<{
  /** Rejection classification, or null after every eligibility check succeeds. */
  reason: RaceEligibilityReason | null;
  /** Canonical immutable content resolved only for an authorized recording. */
  riddles?: RaceRiddleSnapshot[];
}> {
  if (challenge.creatorId === userId) return {reason: "self"};
  /** Provides provider behavior. */
  const provider = raceProviderScope(userId);
  if (provider !== raceProviderScope(challenge.creatorId)) return {reason: "provider"};
  if (challenge.locale !== locale) return {reason: "locale"};
  if (challenge.status !== "active" || challenge.createdAtMs > nowMs || challenge.expiresAtMs <= nowMs) return {reason: "inactive"};
  /** Privacy gates reject candidates before reading attempts, invitations or legacy archives. */
  const [creatorDeletion, playerDeletion, outgoingBlock, incomingBlock] = await readRaceEligibilityDocuments(transaction, [
    getJestAccountDeletionRef(db, challenge.creatorId), getJestAccountDeletionRef(db, userId),
    db.doc(`users/${userId}/blockedRivals/${challenge.creatorId}`), db.doc(`users/${challenge.creatorId}/blockedRivals/${userId}`),
  ]);
  if (creatorDeletion.exists || playerDeletion.exists) return {reason: "deleted"};
  if (outgoingBlock.exists || incomingBlock.exists) return {reason: "blocked"};
  /** Independent attempt and invitation checks share one storage request. */
  const [attempt, invitation] = await readRaceEligibilityDocuments(transaction, [
    db.doc(`raceAttempts/${requestDocumentId(challenge.challengeId, userId)}`), db.doc(`raceInviteLobbies/${challenge.challengeId}`),
  ]);
  if (attempt.exists && (!acceptedRunId || attempt.data()?.runId !== acceptedRunId)) return {reason: "attempted"};
  if ((challenge.scope === "invitation" || challenge.challengeId.startsWith("jest-invite-")) && !invitation.exists) return {reason: "invitation"};
  if (invitation.exists) {
    /** Independent facts preserve authorization regardless of claim/publication ordering. */
    try {
      /** Normalized legacy/new reservation; malformed records fail closed. */
      const lobby = parseRaceInvitation(invitation.data(), true, invitation.id);
      if (lobby.challengeId !== challenge.challengeId || lobby.creatorId !== challenge.creatorId ||
        lobby.recipientId !== userId || lobby.locale !== locale || lobby.expiresAtMs <= nowMs ||
        lobby.cancelledAtMs !== undefined || lobby.claimState !== "claimed" || lobby.publicationState !== "published") return {reason: "invitation"};
    } catch (error) {if (error instanceof HttpsError) return {reason: "invitation"}; throw error;}
  }
  /** Legacy archive hydration occurs only after authorization and prior-attempt checks succeed. */
  const creatorRun = challenge.riddles ? null : await transaction.get(db.doc(`raceRuns/${challenge.creatorRunId}`));
  try {
    /** Provides original behavior. */
    const original = creatorRun?.data();
    if (!challenge.riddles && (!creatorRun?.exists || original?.userId !== challenge.creatorId || original?.locale !== locale)) return {reason: "content"};
    if (!challenge.riddles) assertRaceCreatorArchiveLink(parseRunRecord(original, challenge.creatorRunId), challenge);
    /** Ordered canonical deck validated against retained recording identifiers and content version. */
    const riddles = validateRaceDeckSnapshot(challenge.riddles ?? original?.riddles, challenge.canonicalRiddleIds,
      challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
    assertRaceDeckCompatible(riddles, locale);
    return {reason: null, riddles};
  } catch (error) {
    if (error instanceof HttpsError) return {reason: "content"};
    throw error;
  }
}

/** Batches independent document reads while retaining compatibility with narrow injected readers. */
export function readRaceEligibilityDocuments(transaction: FirebaseFirestore.Transaction,
  references: FirebaseFirestore.DocumentReference[]): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  return typeof transaction.getAll === "function" ? transaction.getAll(...references) : Promise.all(references.map(reference => transaction.get(reference)));
}

/** Converts expected eligibility failures into stable authoritative start errors. */
export function assertRaceChallengeEligible(reason: RaceEligibilityReason | null): void {
  if (!reason) return;
  if (reason === "deleted") throw new JestAccountDeletedError();
  /** Provides code behavior. */
  const code = reason === "attempted" ? "already-exists" :
    ["blocked", "invitation", "provider", "deleted"].includes(reason) ? "permission-denied" : "failed-precondition";
  throw new HttpsError(code, reason === "locale" ? "RaceTo10.ERROR_LOCALE_MISMATCH" : `Race challenge is unavailable: ${reason}.`);
}
