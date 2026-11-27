import {type ReadyRaceRunRequest, type RaceRunResponse} from "../../../../src/races/contracts/index.js";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {raceDeadlineAtMs, RACE_START_LEAD_MS, type RaceRunRecord} from "./raceEngine";
import {projectRaceRunResponse} from "./raceRunResponse";
import {assertRaceInteractionAllowed} from "./raceRunMutation";
import {withRaceTransactionReads} from "./raceTransactionReads";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "../privacy/raceOpponentPrivacy";
import {assertRacePreparedRecording} from "./raceDeckSnapshot";
import {assertRaceChallengeEligible, inspectRaceChallengeEligibility} from "../access/raceEligibility";
import {dbOrDefault, parseRunRecord, parseChallengeRecord, type Firestore} from "../raceSetupService";
import {readRaceMatchOffer, recordRaceMatchTerminal} from "../matchmaking/raceMatchOffer";

/** Schedules one prepared attempt; its first accepted readiness permanently fixes the scored start. */
export async function readyRaceRunForUser(userId: string, input: ReadyRaceRunRequest,
  options: {/** Emulated storage seam. */ /** Stores db. */
  /** Stores db. */
  db?: Firestore; /** Deterministic test clock. */ /** Stores now ms. */
  /** Stores now ms. */
  nowMs?: number} = {}): Promise<RaceRunResponse> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides ref behavior. */
  const ref = db.doc(`raceRuns/${input.runId}`);
  /** Provides run behavior. */
  return db.runTransaction(async (attempt) => {
    /** Eligibility repeats guard reads within this same locked snapshot. */
    const transaction = withRaceTransactionReads(attempt);
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    /** Provides stored behavior. */
    const stored = parseRunRecord(snapshot.data(), snapshot.id);
    if (stored.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    assertJestAccountActive(await transaction.get(getJestAccountDeletionRef(db, userId)));
    /** Provides privacy behavior. */
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, stored);
    await assertRaceInteractionAllowed(transaction, db, userId, privacy.run.opponent?.subjectUserId);
    if (stored.status !== "prepared") {
      /** Replay projects fresh clocks without changing the first accepted readiness. */
      const response = projectRaceRunResponse(privacy.run, options.nowMs ?? Date.now(), input.includeEvaluation);
      if (privacy.scrubbed) transaction.set(ref, raceRunPrivacyWrite(privacy.run, true), {merge: true});
      return response;
    }
    /** Provides offer behavior. */
    const offer = await readRaceMatchOffer(transaction, db, stored);
    /** Owned expiry cleanup does not depend on the continued availability of its publication source. */
    const abandonExpired = (nowMs: number): RaceRunResponse => {
      /** No countdown or scored action was accepted during preparation. */
      const expired: RaceRunRecord = {...privacy.run, status: "abandoned", result: null, wallFinishMs: 0, finishedAtMs: nowMs};
      /** Validate the terminal response before releasing the offer in this transaction. */
      const response = projectRaceRunResponse(expired, nowMs, input.includeEvaluation);
      transaction.set(ref, raceRunPrivacyWrite(expired, privacy.scrubbed), {merge: true});
      recordRaceMatchTerminal(transaction, offer, expired, nowMs);
      return response;
    };
    /** Expired preparation cannot start, so mutable archive eligibility is no longer required. */
    const preflightAtMs = options.nowMs ?? Date.now();
    if (!Number.isFinite(stored.preparationExpiresAtMs) || preflightAtMs >= stored.preparationExpiresAtMs!)
      return abandonExpired(preflightAtMs);
    if (stored.challengeId) {
      /** Provides challenge snapshot behavior. */
      const challengeSnapshot = await transaction.get(db.doc(`raceChallenges/${stored.challengeId}`));
      if (!challengeSnapshot.exists) throw new HttpsError("failed-precondition", "Race challenge is unavailable.");
      /** Provides challenge behavior. */
      const challenge = parseChallengeRecord(challengeSnapshot.data(), challengeSnapshot.id);
      /** Readiness rechecks authorization and immutable recording content transactionally. */
      const inspection = await inspectRaceChallengeEligibility(transaction, db, userId, challenge, stored.locale,
        options.nowMs ?? Date.now(), stored.runId);
      assertRaceChallengeEligible(inspection.reason);
      assertRacePreparedRecording(stored, challenge, inspection.riddles!);
    }
    // Sample after reads so database preparation does not consume the lead-in.
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (nowMs >= stored.preparationExpiresAtMs!) return abandonExpired(nowMs);
    /** Provides scheduled behavior. */
    const scheduled: RaceRunRecord = {...privacy.run, status: "scheduled", readinessAcceptedAtMs: nowMs,
      startedAtMs: nowMs + RACE_START_LEAD_MS};
    scheduled.deadlineAtMs = raceDeadlineAtMs(scheduled);
    /** The countdown and its response share one accepted clock and commit. */
    const response = projectRaceRunResponse(scheduled, nowMs, input.includeEvaluation);
    transaction.set(ref, {...raceRunPrivacyWrite(scheduled, privacy.scrubbed),
      deadlineAtMs: scheduled.deadlineAtMs ?? admin.firestore.FieldValue.delete()}, {merge: true});
    if (offer) transaction.update(offer.ref, {startsAtMs: scheduled.startedAtMs, readinessAcceptedAtMs: nowMs});
    return response;
  });
}
