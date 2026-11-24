import {RACE_CHALLENGE_TTL_MS, RACE_TARGET_CORRECT, RACE_RULES, RaceOutcomeSchema, type RaceOutcome} from "../../../../src/races/contracts/index.js";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../../shared/firebaseAdmin";
import {raceRewardAwardsAgree} from "./raceAchievements";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {raceClock, raceOutcome, raceOperationAtMs, refreshRaceRun, type RaceRunRecord} from "../runs/raceEngine";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "../privacy/raceOpponentPrivacy";
import {persistRaceAchievementEvent, readRaceCoinBalance, stripUndefined, type Firestore} from "../raceSetupService";
import {readRaceMatchOffer, recordRaceMatchTerminal} from "../matchmaking/raceMatchOffer";
import {assertRaceStoredRecord} from "../runs/raceStoredRecords";
import {recordRaceBotWin} from "./raceBotLeaderboard";

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
  sampledAtMs: number,
): Promise<RaceRunRecord> {
  // Enforce canonical scoring even for internal callers passing a typed record directly.
  assertRaceStoredRecord(input, "run");
  /** Receipt, achievement and outbox clocks cannot precede accepted command progress. */
  const nowMs = raceOperationAtMs(input, sampledAtMs);
  /** Provides privacy behavior. */
  const privacy = await resolveRaceOpponentPrivacy(transaction, db, input);
  /** Provides offer behavior. */
  const offer = await readRaceMatchOffer(transaction, db, input);
  if (["prepared", "scheduled", "active"].includes(input.status) && privacy.run.opponent?.subjectUserId) {
    /** Provides opponent behavior. */
    const opponent = privacy.run.opponent.subjectUserId;
    /** Provides blocks behavior. */
    const blocks = await Promise.all([
      transaction.get(db.doc(`users/${input.userId}/blockedRivals/${opponent}`)),
      transaction.get(db.doc(`users/${opponent}/blockedRivals/${input.userId}`)),
    ]);
    if (blocks.some((block) => block.exists)) {
      /** Provides abandoned behavior. */
      const abandoned: RaceRunRecord = {...privacy.run, status: "abandoned", result: null,
        wallFinishMs: raceClock(input, nowMs).wallElapsedMs, finishedAtMs: nowMs};
      transaction.set(db.doc(`raceRuns/${input.runId}`), raceRunPrivacyWrite(abandoned, privacy.scrubbed), {merge: true});
      recordRaceMatchTerminal(transaction, offer, abandoned, nowMs);
      return abandoned;
    }
  }
  /** Provides run behavior. */
  const run = refreshRaceRun(privacy.run, nowMs);
  if (["prepared", "scheduled", "active", "abandoned"].includes(run.status) || run.settledAtMs !== undefined) {
    if (run.status !== input.status) transaction.set(db.doc(`raceRuns/${run.runId}`), raceRunPrivacyWrite(run, privacy.scrubbed), {merge: true});
    recordRaceMatchTerminal(transaction, offer, run, nowMs);
    return run;
  }
  /** Provides outcome behavior. */
  const outcome = raceOutcome(run, nowMs);
  // Check the complete receipt before granting rewards, including a finish after the settlement clock.
  assertRaceStoredRecord({...run, settledAtMs: nowMs, settledOutcome: outcome}, "run");
  /** Provides owner ref behavior. */
  const ownerRef = db.doc(`users/${run.userId}`);
  /** Provides [owner, deletion] behavior. */
  const [owner, deletion] = await Promise.all([
    transaction.get(ownerRef),
    transaction.get(getJestAccountDeletionRef(db, run.userId)),
  ]);
  // Deleted accounts must never be recreated by a delayed deadline or retry.
  if (deletion.exists || !owner.exists) {
    /** Provides settled behavior. */
    const settled = {...run, settledAtMs: nowMs, settledOutcome: outcome};
    transaction.set(db.doc(`raceRuns/${run.runId}`), raceRunPrivacyWrite(settled, privacy.scrubbed), {merge: true});
    recordRaceMatchTerminal(transaction, offer, settled, nowMs);
    return settled;
  }
  if (run.opponent?.kind === "bot" && nowMs >= run.startedAtMs &&
    (outcome.result === "ghost_win" || outcome.result === "timed_out" &&
      run.opponent.adjustedFinishMs <= (run.rulesSnapshot ?? RACE_RULES).maxAdjustedTimeMs))
    recordRaceBotWin(transaction, db, run.opponent.displayName, nowMs);
  /** Provides award behavior. */
  const award = run.achievementProgressRecordedAtMs === undefined
    ? persistRaceAchievementEvent(transaction, ownerRef, owner.data() ?? {}, {
      kind: "completed",
      won: outcome.result === "player_win",
      cleanRun: outcome.correctCount === RACE_TARGET_CORRECT && outcome.totalPenaltyMs === 0,
    }, nowMs)
    : undefined;
  /** Provides settled behavior. */
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
  recordRaceMatchTerminal(transaction, offer, settled, nowMs);
  transaction.create(db.doc(`racePerformanceOutbox/${run.runId}`), {
    runId: run.runId, userId: run.userId, createdAtMs: nowMs, ...pendingRaceDelivery(nowMs),
    expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS),
  });
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
      ...pendingRaceDelivery(nowMs),
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
  sampledAtMs: number,
): Promise<RaceOutcome> {
  /** Reward presentation follows the same canonical clock floor as settlement. */
  const nowMs = raceOperationAtMs(run, sampledAtMs);
  // Fetch before settlement can write; the transaction retries if the balance changes.
  /** Provides owner behavior. */
  const owner = await transaction.get(db.doc(`users/${run.userId}`));
  if (!owner.exists) throw new HttpsError("internal", "Player progress is unavailable for this race.");
  /** Provides settled behavior. */
  const settled = await settleRaceRun(transaction, db, run, nowMs);
  /** Provides outcome behavior. */
  const outcome = settled.settledOutcome ?? raceOutcome(settled, nowMs);
  if (!settled.settlementAwards || settled.achievementOutcomePresentedAtMs !== undefined) return acceptedRaceOutcome(outcome);
  /** Provides coins behavior. */
  const coins = readRaceCoinBalance(owner.data() ?? {});
  /** The exact public reward response must succeed before consuming its presentation receipt. */
  const response = acceptedRaceOutcome({
    ...outcome,
    ...settled.settlementAwards,
    newCoins: coins + (run.achievementProgressRecordedAtMs === undefined ? settled.settlementAwards.achievementCoinsAwarded : 0),
  });
  transaction.set(db.doc(`raceRuns/${run.runId}`), {achievementOutcomePresentedAtMs: nowMs}, {merge: true});
  return response;
}

/** Rejects an undeliverable public outcome inside the caller's transaction without exposing stored diagnostics. */
function acceptedRaceOutcome(outcome: RaceOutcome): RaceOutcome {
  /** Public reward identifiers and safe currency values are stricter than optional storage metadata. */
  const accepted = RaceOutcomeSchema.safeParse(outcome);
  if (!accepted.success || !raceRewardAwardsAgree(accepted.data.newlyUnlockedAchievementIds, accepted.data.achievementCoinsAwarded))
    throw new HttpsError("data-loss", "Stored race outcome is invalid.");
  return accepted.data;
}
import {pendingRaceDelivery} from "../delivery/raceDeliveryFailures";
