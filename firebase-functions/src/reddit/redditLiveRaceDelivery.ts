import {RACE_TARGET_CORRECT} from "@qwordly/core/race";
import {runWithJestAccountOperationLease} from "../jest/jestAccountDeletion";
import {isRedditFeatureEnabled} from "./redditFeatureFlags";
import {finishRedditLiveRaceReferralDelivery, needsRedditLiveRaceReferral} from "./redditLiveRaceReferralDelivery";
import {validateRedditLiveRaceReferralSource} from "./redditLiveRaceReferralDelivery";
import {parseRacePerformanceEvent} from "../race/raceDeliveryRecords";
import {HttpsError} from "firebase-functions/v2/https";
import {readRedditLiveTournamentRun} from "../race/redditLiveTournament";
import {assertRedditTournamentDeck, deriveRedditTournamentEntry, recordRedditTournamentRun} from "../race/redditTournament";
import type {LiveMatch} from "../race/raceLiveState";
import type {Firestore} from "../race/raceSetupService";

/** Eligible solve delivery and administrator dry-run share the official source validator. */
export async function readRedditLiveTournamentDeliveryInput(transaction: FirebaseFirestore.Transaction, db: Firestore,
  receipt: ReturnType<typeof parseRacePerformanceEvent>, nowMs: number) {
  /** The private record is read within the current authoritative transaction. */
  const snapshot = await transaction.get(db.doc(`liveRaceMatches/${receipt.liveMatchId}`));
  /** Private match linkage identifies the settled human winner. */
  const match = snapshot.data() as LiveMatch;
  if (!match || match.winner !== 0 && match.winner !== 1) throw new HttpsError("data-loss", "Stored live score winner is invalid.");
  /** Only a completed ten-riddle solve qualifies for an official tournament score. */
  const candidate = match.runs[match.winner];
  if (candidate.status !== "completed" || candidate.correctCount !== RACE_TARGET_CORRECT) return undefined;
  /** The official validator resolves private completion and its independent frozen deck. */
  const {run, deck} = await readRedditLiveTournamentRun(transaction, db, receipt.userId, receipt.liveTicketId!);
  assertRedditTournamentDeck(run, deck);
  if (run.finishedAtMs === undefined || run.finishedAtMs > nowMs)
    throw new HttpsError("data-loss", "Stored live score finish is invalid.");
  deriveRedditTournamentEntry(receipt.userId, run.locale, run, run.finishedAtMs);
  return {runId: receipt.liveTicketId!, locale: run.locale};
}

/** The existing live winner receipt recovers official standings independently of a mounted browser. */
export async function finishRedditLiveRaceDelivery(db: Firestore, eventRef: FirebaseFirestore.DocumentReference,
  userId: string, nowMs: number): Promise<void> {
  if (isRedditFeatureEnabled("tournaments")) {
    // Deletion waits for this lease before sweeping board entries. A late worker
    // cannot recreate deleted identity or tournament rows after that sweep.
    await runWithJestAccountOperationLease(userId, 120, async () => {
      /** Source validation selects only an opaque owned ticket and its exact content locale. */
      const input = await db.runTransaction(async transaction => {
        /** A re-read receipt prevents a deleted or acknowledged delivery from being reconstructed. */
        const current = await transaction.get(eventRef);
        if (!current.exists || current.data()?.delivered === true) return undefined;
        /** Existing winner delivery receipt retains its original owner, source and retention. */
        const receipt = parseRacePerformanceEvent(current.data(), eventRef.id);
        if (receipt.userId !== userId || receipt.expiresAt.toMillis() <= nowMs ||
          !await validateRedditLiveRaceReferralSource(transaction, db, receipt, nowMs)) return undefined;
        return readRedditLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
      });
      if (input && isRedditFeatureEnabled("tournaments")) await recordRedditTournamentRun(userId, input, {db, nowMs});
    });
  }
  if (needsRedditLiveRaceReferral(userId)) {
    await finishRedditLiveRaceReferralDelivery(db, eventRef, userId, nowMs);
  } else {
    // Official recording and referral rewards have independent emergency switches.
    await db.runTransaction(async transaction => {
      /** A re-read receipt prevents a deleted or acknowledged delivery from being reconstructed. */
      const current = await transaction.get(eventRef);
      if (!current.exists || current.data()?.delivered === true) return;
      transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
    });
  }
}
