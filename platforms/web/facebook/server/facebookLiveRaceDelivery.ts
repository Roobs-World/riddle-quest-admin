import {RACE_TARGET_CORRECT} from "@riddle-quest/core/race";
import {runWithJestAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {finishFacebookRaceReferralDelivery, needsFacebookRaceReferral} from "./facebookRaceReferralDelivery";
import {validateFacebookLiveRaceReferralSource} from "./facebookLiveRaceReferralDelivery";
import {parseRacePerformanceEvent} from "../../../../firebase-functions/src/race/raceDeliveryRecords";
import {HttpsError} from "firebase-functions/v2/https";
import {readFacebookLiveTournamentRun} from "./race/facebookLiveTournament";
import {assertFacebookTournamentDeck, deriveFacebookTournamentEntry, recordFacebookTournamentRun} from "./race/facebookTournament";
import type {LiveMatch} from "../../../../firebase-functions/src/race/raceLiveState";
import type {Firestore} from "../../../../firebase-functions/src/race/raceSetupService";
import {recordFacebookContextBoardBindingRun} from "./race/facebookContextBoard";
import {parseFacebookContextCompetition} from "./race/facebookContextService";

/** Eligible solve delivery and administrator dry-run share the official source validator. */
export async function readFacebookLiveTournamentDeliveryInput(transaction: FirebaseFirestore.Transaction, db: Firestore,
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
  const {run, deck} = await readFacebookLiveTournamentRun(transaction, db, receipt.userId, receipt.liveTicketId!);
  assertFacebookTournamentDeck(run, deck);
  if (run.finishedAtMs === undefined || run.finishedAtMs > nowMs)
    throw new HttpsError("data-loss", "Stored live score finish is invalid.");
  deriveFacebookTournamentEntry(receipt.userId, run.locale, run, run.finishedAtMs);
  return {runId: receipt.liveTicketId!, locale: run.locale};
}

/** The existing live winner receipt recovers official standings independently of a mounted browser. */
export async function finishFacebookLiveRaceDelivery(db: Firestore, eventRef: FirebaseFirestore.DocumentReference,
  userId: string, nowMs: number, hasContext = false): Promise<void> {
  if (hasContext && isFacebookFeatureEnabled("matchmaking")) {
    await runWithJestAccountOperationLease(userId, 120, async () => {
      /** Deletion, receipt/source bindings and the original active board are re-read before delivery. */
      const input = await db.runTransaction(async transaction => {
        /** A retired receipt cannot reconstruct a deleted score. */
        const current = await transaction.get(eventRef);
        if (!current.exists || current.data()?.delivered === true) return undefined;
        /** Only a retained Facebook winner receipt can carry a context destination. */
        const receipt = parseRacePerformanceEvent(current.data(), eventRef.id);
        if (receipt.userId !== userId || !receipt.facebookContext || receipt.expiresAt.toMillis() <= nowMs ||
          !await validateFacebookLiveRaceReferralSource(transaction, db, receipt, nowMs)) return undefined;
        /** Forfeit wins still grant the existing win receipt but never synthesize a context solve. */
        const score = await readFacebookLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
        if (!score) return undefined;
        /** Expired, replaced or departed memberships suppress only the old context projection. */
        const snapshot = await transaction.get(db.doc(`facebookContextCompetitions/${receipt.facebookContext.contextKey}`));
        if (!snapshot.exists) return undefined;
        /** Corrupt authoritative boards remain failures, rather than being silently acknowledged. */
        const board = parseFacebookContextCompetition(snapshot.data());
        /** Only the originally captured membership may receive a delayed score. */
        const member = board.members.find(row => row.userId === userId && row.active);
        if (board.contextKey !== receipt.facebookContext.contextKey || board.locale !== score.locale || nowMs < board.createdAtMs ||
          nowMs >= board.expiresAtMs || board.createdAtMs !== receipt.facebookContext.createdAtMs ||
          member?.joinedAtMs !== receipt.facebookContext.joinedAtMs) return undefined;
        return {...score, binding: receipt.facebookContext};
      });
      if (input && isFacebookFeatureEnabled("matchmaking")) await recordFacebookContextBoardBindingRun(userId, input, {db, nowMs});
    });
  }
  if (isFacebookFeatureEnabled("tournaments")) {
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
          !await validateFacebookLiveRaceReferralSource(transaction, db, receipt, nowMs)) return undefined;
        return readFacebookLiveTournamentDeliveryInput(transaction, db, receipt, nowMs);
      });
      if (input && isFacebookFeatureEnabled("tournaments")) await recordFacebookTournamentRun(userId, input, {db, nowMs});
    });
  }
  if (needsFacebookRaceReferral(userId, true)) {
    await finishFacebookRaceReferralDelivery(db, eventRef, userId, nowMs);
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
