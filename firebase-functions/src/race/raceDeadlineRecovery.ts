import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {raceDeadlineAtMs} from "./raceEngine";
import {parseRunRecord, type Firestore} from "./raceSetupService";
import {settleRaceRun} from "./raceSettlement";

/** Background processing states never change a player's scored clock or result. */
type DeadlineRecovery = {
  /** Original indexed deadline retained for diagnostics. */ originalDeadlineAtMs: number;
  /** Consecutive transient processing failures. */ attempts: number;
  /** Next storage retry, independent of the scored start. */ nextAttemptAtMs: number;
};

/** Processes a due run, removing corrupt records from the queue and deferring transient failures. */
export async function processRaceDeadline(db: Firestore, ref: FirebaseFirestore.DocumentReference, nowMs: number): Promise<void> {
  try {
    /** Provides state behavior. */
    const state = await db.runTransaction(async transaction => {
      /** Re-read current authority after the indexed lookup. */
      const current = await transaction.get(ref);
      if (!current.exists || !["prepared", "scheduled", "active"].includes(current.data()?.status) || !Number.isFinite(current.data()?.deadlineAtMs) || current.data()!.deadlineAtMs > nowMs) return "skipped";
      /** Unsupported persisted records require operator repair rather than repeated automatic retries. */
      let run;
      try {run = parseRunRecord(current.data(), current.id);}
      catch (error) {
        if (!(error instanceof HttpsError) || !["internal", "data-loss"].includes(error.code)) throw error;
        transaction.set(db.doc(`raceDeadlineFailures/${ref.id}`), {runId: ref.id, state: "quarantined", failureCode: "data-loss",
          originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data()!.deadlineAtMs,
          quarantinedAtMs: nowMs, expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + 90 * 86_400_000)});
        transaction.update(ref, {deadlineAtMs: admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: nowMs});
        return "quarantined";
      }
      if (run.runId !== ref.id) throw new HttpsError("data-loss", "Race deadline identity does not match its document.");
      await settleRaceRun(transaction, db, run, nowMs);
      return "processed";
    });
    if (state === "quarantined") logger.write({severity: "ERROR", message: "Race deadline requires repair and replay", runId: ref.id, failureCode: "data-loss"});
  } catch (error) {
    // Scheduling metadata is not read by raceClock/refreshRaceRun. Delaying this
    // index entry cannot grant extra playing time or change the canonical outcome.
    await db.runTransaction(async transaction => {
      /** A concurrent mutation/settlement takes precedence over retry bookkeeping. */
      const current = await transaction.get(ref);
      if (!current.exists || !["prepared", "scheduled", "active"].includes(current.data()?.status) || !Number.isFinite(current.data()?.deadlineAtMs) || current.data()!.deadlineAtMs > nowMs) return;
      if (error instanceof HttpsError && error.code === "data-loss") {
        transaction.set(db.doc(`raceDeadlineFailures/${ref.id}`), {runId: ref.id, state: "quarantined", failureCode: "data-loss",
          originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data()!.deadlineAtMs, quarantinedAtMs: nowMs,
          expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + 90 * 86_400_000)});
        transaction.update(ref, {deadlineAtMs: admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: nowMs});
        logger.write({severity: "ERROR", message: "Race deadline requires repair and replay", runId: ref.id, failureCode: "data-loss"});
        return;
      }
      /** Bounded exponential storage backoff prevents one failed account monopolizing every page. */
      const attempts = Math.min(20, Math.max(0, Number(current.data()?.deadlineRecovery?.attempts) || 0) + 1);
      /** Provides next attempt at ms behavior. */
      const nextAttemptAtMs = nowMs + Math.min(900_000, 30_000 * 2 ** Math.min(5, attempts - 1));
      /** Provides recovery behavior. */
      const recovery: DeadlineRecovery = {originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data()!.deadlineAtMs, attempts, nextAttemptAtMs};
      transaction.update(ref, {deadlineAtMs: nextAttemptAtMs, deadlineRecovery: recovery});
    });
    throw error;
  }
}

/** Admin-only repair seam: validates repaired source before restoring its derived scheduling index. */
export async function replayRaceDeadline(db: Firestore, runId: string, nowMs: number): Promise<void> {
  await db.runTransaction(async transaction => {
    /** Canonical repaired source and its diagnostic receipt are read together. */
    const ref = db.doc(`raceRuns/${runId}`);
    /** Provides [source, failure] behavior. */
    const [source, failure] = await Promise.all([transaction.get(ref), transaction.get(db.doc(`raceDeadlineFailures/${runId}`))]);
    if (!source.exists || !failure.exists || failure.data()?.state !== "quarantined") throw new HttpsError("failed-precondition", "No quarantined deadline is available to replay.");
    /** Provides run behavior. */
    const run = parseRunRecord(source.data(), source.id);
    /** Provides deadline at ms behavior. */
    const deadlineAtMs = raceDeadlineAtMs(run);
    if (run.runId !== runId || !["prepared", "scheduled", "active"].includes(run.status) || !Number.isFinite(deadlineAtMs)) throw new HttpsError("failed-precondition", "Repaired run has no valid unattended deadline.");
    transaction.update(ref, {deadlineAtMs, deadlineRecovery: admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: admin.firestore.FieldValue.delete()});
    transaction.update(failure.ref, {state: "replayed", replayedAtMs: nowMs});
  });
}
