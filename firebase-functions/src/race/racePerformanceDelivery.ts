import {withRaceDeliveryReceipt} from "./raceDeliveryFailures";
import {HttpsError} from "firebase-functions/v2/https";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {admin} from "../shared/firebaseAdmin";
import {emptyRaceMatchProfile, RaceMatchProfileSchema, racePerformanceSample, recordRacePerformance, recordRaceCompletion} from "./raceMatchPerformance";
import {parseRunRecord, type Firestore} from "./raceSetupService";
import {parseRacePerformanceEvent} from "./raceDeliveryRecords";

/** Idempotently folds a settled owner's performance into their language/category estimate. */
export async function deliverRacePerformance(runId: string, db: Firestore = admin.firestore(), nowMs = Date.now()): Promise<boolean> {
  /** Provides event ref behavior. */
  const eventRef = db.doc(`racePerformanceOutbox/${runId}`);
  return withRaceDeliveryReceipt(db, eventRef, nowMs, () => db.runTransaction(async (transaction) => {
    /** Provides event behavior. */
    const event = await transaction.get(eventRef);
    if (!event.exists || event.data()?.delivered === true) return false;
    /** Provides user id behavior. */
    const receipt = parseRacePerformanceEvent(event.data(), runId);
    if (receipt.nextAttemptAtMs !== undefined && receipt.nextAttemptAtMs > nowMs) return false;
    /** Owner linkage comes from the validated server receipt and is rechecked against the source. */
    const userId = receipt.userId;
    /** Provides [source, owner, deletion] behavior. */
    const [source, owner, deletion] = await Promise.all([transaction.get(db.doc(`raceRuns/${runId}`)),
      transaction.get(db.doc(`users/${userId}`)), transaction.get(getJestAccountDeletionRef(db, userId))]);
    if (!source.exists || !owner.exists || deletion.exists) {
      transaction.update(eventRef, {delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: nowMs});
      return false;
    }
    /** Provides run behavior. */
    const run = parseRunRecord(source.data(), source.id);
    if (run.runId !== runId || run.userId !== userId || !run.settledOutcome || run.settledAtMs === undefined || receipt.createdAtMs !== run.settledAtMs ||
      run.finishedAtMs !== undefined && run.finishedAtMs > run.settledAtMs)
      throw new HttpsError("data-loss", "Performance source is not settled.");
    /** Provides ref behavior. */
    const ref = db.doc(`users/${userId}/raceMatchProfiles/${run.locale}`);
    /** Provides existing behavior. */
    const existing = await transaction.get(ref);
    /** Provides profile behavior. */
    const profile = existing.exists ? RaceMatchProfileSchema.parse(existing.data()) : emptyRaceMatchProfile();
    /** Provides sample behavior. */
    const sample = racePerformanceSample(run);
    /** Completion remains measurable even when idle losses supply no speed observation. */
    const observedAtMs = run.finishedAtMs ?? run.settledAtMs;
    /** Deadline recovery and delayed outbox delivery cannot make an old finish current. */
    const completion = recordRaceCompletion(profile, run.role, run.categoryId, run.correctCount >= 10, observedAtMs);
    transaction.set(ref, sample ? recordRacePerformance(completion, run.categoryId, sample, observedAtMs) : completion);
    transaction.update(eventRef, {delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs});
    return true;
  }));
}
