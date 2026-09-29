import {RACE_CHALLENGE_TTL_MS, RACE_TARGET_CORRECT, type RaceOutcome} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceOutcome, refreshRaceRun, type RaceRunRecord} from "./raceEngine";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
import {persistRaceAchievementEvent, stripUndefined, type Firestore} from "./raceSetupService";

/** Maps a canonical challenger outcome into the recording creator's result. */
export function creatorRaceResult(result: RaceOutcome["result"]): "win" | "loss" | "tie" {
  if (result === "player_win") return "loss";
  if (result === "tie") return "tie";
  if (result === "ghost_win" || result === "timed_out") return "win";
  throw new HttpsError("failed-precondition", "A solo recording has no opposing result.");
}

/**
 * Settles a terminal run and its owner rewards once inside the caller's transaction.
 * Reads precede writes. The run is the settlement receipt; copied provider identities
 * never enter the creator-delivery outbox. Active and abandoned runs earn no rewards.
 */
export async function settleRaceRun(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  input: RaceRunRecord,
  nowMs: number,
): Promise<RaceRunRecord> {
  const privacy = await resolveRaceOpponentPrivacy(transaction, db, input);
  const run = refreshRaceRun(privacy.run, nowMs);
  if (run.status === "active" || run.status === "abandoned" || run.settledAtMs !== undefined) return run;
  const outcome = raceOutcome(run, nowMs);
  const ownerRef = db.doc(`users/${run.userId}`);
  const [owner, deletion] = await Promise.all([
    transaction.get(ownerRef),
    transaction.get(getJestAccountDeletionRef(db, run.userId)),
  ]);
  // Deleted accounts must never be recreated by a delayed deadline or retry.
  if (deletion.exists || !owner.exists) {
    const settled = {...run, settledAtMs: nowMs, settledOutcome: outcome};
    transaction.set(db.doc(`raceRuns/${run.runId}`), raceRunPrivacyWrite(settled, privacy.scrubbed), {merge: true});
    return settled;
  }
  const award = run.achievementProgressRecordedAtMs === undefined
    ? persistRaceAchievementEvent(transaction, ownerRef, owner.data() ?? {}, {
      kind: "completed",
      won: outcome.result === "player_win",
      cleanRun: outcome.correctCount === RACE_TARGET_CORRECT && outcome.totalPenaltyMs === 0,
    }, nowMs)
    : undefined;
  const settled: RaceRunRecord = {
    ...run,
    settledAtMs: nowMs,
    settledOutcome: outcome,
    achievementProgressRecordedAtMs: run.achievementProgressRecordedAtMs ?? nowMs,
    ...(award ? {settlementAwards: {
      newlyUnlockedAchievementIds: award.newlyUnlockedAchievementIds,
      achievementCoinsAwarded: award.achievementCoinsAwarded,
    }} : {}),
  };
  transaction.set(db.doc(`raceRuns/${run.runId}`), raceRunPrivacyWrite(settled, privacy.scrubbed), {merge: true});
  if (run.challengeId && run.opponent?.subjectUserId) {
    transaction.create(db.doc(`raceSettlementOutbox/${run.runId}`), stripUndefined({
      runId: run.runId,
      userId: run.userId,
      creatorId: run.opponent.subjectUserId,
      challengeId: run.challengeId,
      categoryId: run.categoryId,
      result: creatorRaceResult(outcome.result),
      adjustedDeltaMs: outcome.adjustedFinishMs - run.opponent.adjustedFinishMs,
      createdAtMs: nowMs,
      delivered: false,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS),
    }));
  }
  return settled;
}

/** Returns a settled outcome and presents already-granted rewards at most once. */
export async function readSettledRaceOutcome(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  run: RaceRunRecord,
  nowMs: number,
): Promise<RaceOutcome> {
  // Fetch before settlement can write; the transaction retries if the balance changes.
  const owner = await transaction.get(db.doc(`users/${run.userId}`));
  if (!owner.exists) throw new HttpsError("internal", "Player progress is unavailable for this race.");
  const settled = await settleRaceRun(transaction, db, run, nowMs);
  const outcome = settled.settledOutcome ?? raceOutcome(settled, nowMs);
  if (!settled.settlementAwards || settled.achievementOutcomePresentedAtMs !== undefined) return outcome;
  transaction.set(db.doc(`raceRuns/${run.runId}`), {achievementOutcomePresentedAtMs: nowMs}, {merge: true});
  const coins = Number(owner.data()?.coins ?? 0);
  return {
    ...outcome,
    ...settled.settlementAwards,
    newCoins: coins + (run.achievementProgressRecordedAtMs === undefined ? settled.settlementAwards.achievementCoinsAwarded : 0),
  };
}
