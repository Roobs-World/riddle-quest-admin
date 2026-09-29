import {HttpsError} from "firebase-functions/v2/https";
import {JestAccountDeletedError, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {validateRaceDeckSnapshot} from "./raceDeckSnapshot";
import {requestDocumentId, type Firestore, type RaceChallengeRecord} from "./raceSetupService";

/** Provider scope derived exclusively from an authenticated game-owned identity. */
export type RaceProviderScope = "jest" | "facebook" | "reddit";
/** Stable expected rejection reasons; storage failures propagate separately. */
export type RaceEligibilityReason = "self" | "provider" | "locale" | "inactive" | "deleted" | "blocked" | "attempted" | "invitation" | "content";

/** Identifies a validated provider namespace without trusting client-supplied scope. */
export function raceProviderScope(userId: string): RaceProviderScope | undefined {
  const match = /^(jest|facebook|reddit)_[a-f0-9]{40}$/.exec(userId);
  return match?.[1] as RaceProviderScope | undefined;
}

/**
 * Reads discovery and acceptance eligibility through the same transaction seam.
 * Caller must first read the canonical challenge in this transaction. All checks
 * are side-effect-free; accepting callers retain their own attempt-creation write.
 */
export async function raceChallengeEligibility(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  userId: string,
  challenge: RaceChallengeRecord,
  locale: RaceChallengeRecord["locale"],
  nowMs: number,
  acceptedRunId?: string,
): Promise<RaceEligibilityReason | null> {
  if (challenge.creatorId === userId) return "self";
  const provider = raceProviderScope(userId);
  if (provider && provider !== raceProviderScope(challenge.creatorId)) return "provider";
  if (challenge.locale !== locale) return "locale";
  if (challenge.status !== "active" || challenge.expiresAtMs <= nowMs) return "inactive";
  const [creatorDeletion, playerDeletion, outgoingBlock, incomingBlock, attempt, invitation, creatorRun] = await Promise.all([
    transaction.get(getJestAccountDeletionRef(db, challenge.creatorId)),
    transaction.get(getJestAccountDeletionRef(db, userId)),
    transaction.get(db.doc(`users/${userId}/blockedRivals/${challenge.creatorId}`)),
    transaction.get(db.doc(`users/${challenge.creatorId}/blockedRivals/${userId}`)),
    transaction.get(db.doc(`raceAttempts/${requestDocumentId(challenge.challengeId, userId)}`)),
    transaction.get(db.doc(`raceInviteLobbies/${challenge.challengeId}`)),
    challenge.riddles ? Promise.resolve(null) : transaction.get(db.doc(`raceRuns/${challenge.creatorRunId}`)),
  ]);
  if (creatorDeletion.exists || playerDeletion.exists) return "deleted";
  if (outgoingBlock.exists || incomingBlock.exists) return "blocked";
  if (attempt.exists && (!acceptedRunId || attempt.data()?.runId !== acceptedRunId)) return "attempted";
  if ((challenge.scope === "invitation" || challenge.challengeId.startsWith("jest-invite-")) && !invitation.exists) return "invitation";
  if (invitation.exists) {
    const lobby = invitation.data();
    if (lobby?.challengeId !== challenge.challengeId || lobby?.creatorId !== challenge.creatorId ||
      lobby?.recipientId !== userId || lobby?.locale !== locale || !Number.isFinite(lobby?.expiresAtMs) ||
      lobby?.expiresAtMs <= nowMs || !["claimed", "published"].includes(lobby?.status)) return "invitation";
  }
  try {
    const original = creatorRun?.data();
    if (!challenge.riddles && (!creatorRun?.exists || original?.userId !== challenge.creatorId || original?.locale !== locale)) return "content";
    validateRaceDeckSnapshot(challenge.riddles ?? original?.riddles, challenge.canonicalRiddleIds,
      challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
  } catch (error) {
    if (error instanceof HttpsError) return "content";
    throw error;
  }
  return null;
}

/** Converts expected eligibility failures into stable authoritative start errors. */
export function assertRaceChallengeEligible(reason: RaceEligibilityReason | null): void {
  if (!reason) return;
  if (reason === "deleted") throw new JestAccountDeletedError();
  const code = reason === "attempted" ? "already-exists" :
    ["blocked", "invitation", "provider", "deleted"].includes(reason) ? "permission-denied" : "failed-precondition";
  throw new HttpsError(code, reason === "locale" ? "RaceTo10.ERROR_LOCALE_MISMATCH" : `Race challenge is unavailable: ${reason}.`);
}
