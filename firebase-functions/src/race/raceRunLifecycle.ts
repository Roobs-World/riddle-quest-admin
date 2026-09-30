import {RaceRunResponseSchema, type ReadyRaceRunRequest, type RaceRunResponse} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceDeadlineAtMs, RACE_START_LEAD_MS, toRaceRunView, type RaceRunRecord} from "./raceEngine";
import {assertRaceInteractionAllowed} from "./raceRunMutation";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
import {assertRacePreparedRecording} from "./raceDeckSnapshot";
import {assertRaceChallengeEligible, inspectRaceChallengeEligibility} from "./raceEligibility";
import {dbOrDefault, parseRunRecord, parseChallengeRecord, type Firestore} from "./raceSetupService";
import {readRaceMatchOffer, recordRaceMatchTerminal} from "./raceMatchOffer";

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
  const run = await db.runTransaction(async (transaction) => {
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
    if (stored.status !== "prepared") return privacy.run;
    /** Provides offer behavior. */
    const offer = await readRaceMatchOffer(transaction, db, stored);
    if (stored.challengeId) {
      /** Provides challenge snapshot behavior. */
      const challengeSnapshot = await transaction.get(db.doc(`raceChallenges/${stored.challengeId}`));
      if (!challengeSnapshot.exists) throw new HttpsError("failed-precondition", "Race challenge is unavailable.");
      /** Provides challenge behavior. */
      const challenge = parseChallengeRecord(challengeSnapshot.data(), challengeSnapshot.id);
      const inspection = await inspectRaceChallengeEligibility(transaction, db, userId, challenge, stored.locale,
        options.nowMs ?? Date.now(), stored.runId);
      assertRaceChallengeEligible(inspection.reason);
      assertRacePreparedRecording(stored, challenge, inspection.riddles!);
    }
    // Sample after reads so database preparation does not consume the lead-in.
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isFinite(stored.preparationExpiresAtMs) || nowMs >= stored.preparationExpiresAtMs!) {
      /** Provides expired behavior. */
      const expired: RaceRunRecord = {...privacy.run, status: "abandoned", result: null, wallFinishMs: 0, finishedAtMs: nowMs};
      transaction.set(ref, raceRunPrivacyWrite(expired, privacy.scrubbed), {merge: true});
      recordRaceMatchTerminal(transaction, offer, expired, nowMs);
      return expired;
    }
    /** Provides scheduled behavior. */
    const scheduled: RaceRunRecord = {...privacy.run, status: "scheduled", startedAtMs: nowMs + RACE_START_LEAD_MS};
    scheduled.deadlineAtMs = raceDeadlineAtMs(scheduled);
    transaction.set(ref, {...raceRunPrivacyWrite(scheduled, privacy.scrubbed),
      deadlineAtMs: scheduled.deadlineAtMs ?? admin.firestore.FieldValue.delete()}, {merge: true});
    if (offer) transaction.update(offer.ref, {startsAtMs: scheduled.startedAtMs, readinessAcceptedAtMs: nowMs});
    return scheduled;
  });
  return RaceRunResponseSchema.parse({run: toRaceRunView(run, options.nowMs ?? Date.now(), input.includeEvaluation)});
}
