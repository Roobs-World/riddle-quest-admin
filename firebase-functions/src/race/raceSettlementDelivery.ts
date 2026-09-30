import {withRaceDeliveryReceipt} from "./raceDeliveryFailures";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {creatorRaceResult} from "./raceSettlement";
import {parseRunRecord, persistRaceAchievementEvent, requestDocumentId, type Firestore} from "./raceSetupService";
import {parseRaceSettlementEvent} from "./raceDeliveryRecords";

/**
 * Delivers one canonical settlement outbox event transactionally and idempotently.
 * Revalidates the source result, account lifecycle, and both blocking directions.
 * A missing/deleted source is acknowledged without reintroducing player identity.
 */
export async function deliverRaceSettlement(
  runId: string,
  db: Firestore = admin.firestore(),
  nowMs = Date.now(),
): Promise<boolean> {
  /** Provides event ref behavior. */
  const eventRef = db.doc(`raceSettlementOutbox/${runId}`);
  return withRaceDeliveryReceipt(db, eventRef, nowMs, () => db.runTransaction(async (transaction) => {
    /** Provides event snapshot behavior. */
    const eventSnapshot = await transaction.get(eventRef);
    if (!eventSnapshot.exists || eventSnapshot.data()?.delivered === true) return false;
    /** Provides event behavior. */
    const event = parseRaceSettlementEvent(eventSnapshot.data(), runId);
    if (event.nextAttemptAtMs !== undefined && event.nextAttemptAtMs > nowMs) return false;
    /** Provides [run snapshot, challenger, creator, challenger deletion, creator deletion, outgoing block, incoming block] behavior. */
    const [runSnapshot, challenger, creator, challengerDeletion, creatorDeletion, outgoingBlock, incomingBlock] =
      await Promise.all([
        transaction.get(db.doc(`raceRuns/${runId}`)),
        transaction.get(db.doc(`users/${event.userId}`)),
        transaction.get(db.doc(`users/${event.creatorId}`)),
        transaction.get(getJestAccountDeletionRef(db, event.userId)),
        transaction.get(getJestAccountDeletionRef(db, event.creatorId)),
        transaction.get(db.doc(`users/${event.userId}/blockedRivals/${event.creatorId}`)),
        transaction.get(db.doc(`users/${event.creatorId}/blockedRivals/${event.userId}`)),
      ]);
    if (!runSnapshot.exists || !creator.exists || !challenger.exists || challengerDeletion.exists ||
      creatorDeletion.exists || outgoingBlock.exists || incomingBlock.exists) {
      transaction.update(eventRef, {delivered: true, deliveryState: "suppressed", deliveredAtMs: nowMs, suppressed: true});
      return false;
    }
    /** Provides run behavior. */
    const run = parseRunRecord(runSnapshot.data(), runSnapshot.id);
    /** Provides outcome behavior. */
    const outcome = run.settledOutcome;
    if (run.runId !== runId || !outcome || !run.challengeId || run.settledAtMs === undefined || run.userId !== event.userId ||
      run.opponent?.subjectUserId !== event.creatorId || run.challengeId !== event.challengeId ||
      creatorRaceResult(outcome.result) !== event.result || event.categoryId !== run.categoryId ||
      event.adjustedDeltaMs !== outcome.adjustedFinishMs - (run.opponent?.adjustedFinishMs ?? 0) || event.createdAtMs !== run.settledAtMs)
      throw new Error("race-settlement-source-mismatch");
    /** Provides item id behavior. */
    const itemId = requestDocumentId(run.challengeId, run.userId);
    // Legacy completion may already have delivered this challenge before migration.
    /** Provides inbox ref behavior. */
    const inboxRef = db.doc(`users/${event.creatorId}/raceInbox/${itemId}`);
    /** Provides existing inbox behavior. */
    const existingInbox = await transaction.get(inboxRef);
    if (!existingInbox.exists) {
      /** Provides profile behavior. */
      const profile = challenger.data() ?? {};
      transaction.create(inboxRef, {
        itemId,
        challengeId: run.challengeId,
        opponentUserId: run.userId,
        opponentDisplayName: String(profile.displayName || profile.username || "Riddle Quest player").trim().slice(0, 80),
        ...(typeof profile.avatarUrl === "string" ? {opponentAvatarUrl: profile.avatarUrl} : {}),
        categoryId: run.categoryId,
        result: creatorRaceResult(outcome.result),
        adjustedDeltaMs: event.adjustedDeltaMs,
        read: false,
        createdAtMs: event.createdAtMs,
        expiresAt: event.expiresAt,
      });
      for (const [viewer, target] of [[run.userId, event.creatorId], [event.creatorId, run.userId]]) {
        transaction.set(db.doc(`users/${viewer}/knownRivals/${target}`), {
          targetUserId: target,
          source: "completed_race",
          challengeId: run.challengeId,
          establishedAtMs: event.createdAtMs,
        }, {merge: true});
      }
      persistRaceAchievementEvent(transaction, db.doc(`users/${event.creatorId}`), creator.data() ?? {},
        {kind: "opponent_resolved", won: event.result === "win"}, event.createdAtMs);
    }
    transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
    return !existingInbox.exists;
  }));
}
