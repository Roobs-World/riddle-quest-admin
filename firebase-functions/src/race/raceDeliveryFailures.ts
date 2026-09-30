import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import type {Firestore} from "./raceSetupService";
import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";

/** New receipts expose processing state without overloading the legacy delivered flag. */
export const pendingRaceDelivery = (nowMs: number) => ({delivered: false, deliveryState: "pending", deliveryAttempts: 0, nextAttemptAtMs: nowMs});

/** Bounded exponential retry with deterministic jitter prevents synchronized storage retry waves. */
export function raceDeliveryRetryAt(eventId: string, attempts: number, nowMs: number): number {
  /** Per-event jitter remains stable when a failed invocation is retried. */
  const fraction = createHash("sha256").update(`${eventId}:${attempts}`).digest().readUInt32BE(0) / 0xffffffff;
  return nowMs + Math.min(900000, Math.round(30000 * 2 ** Math.min(5, Math.max(0, attempts - 1)) * (0.8 + fraction * 0.4)));
}

/** Permanent canonical corruption is quarantined; infrastructure failures remain pending for retry. */
export async function withRaceDeliveryReceipt(db: Firestore, eventRef: FirebaseFirestore.DocumentReference,
  nowMs: number, operation: () => Promise<boolean>): Promise<boolean> {
  try { return await operation(); }
  catch (error) {
    /** Provides permanent behavior. */
    const permanent = (error instanceof HttpsError && (error.code === "data-loss" ||
      error.code === "internal" && error.message === "Stored Race to 10 state is invalid.")) ||
      (error instanceof Error && (error.name === "ZodError" || ["invalid-race-settlement-event", "race-settlement-source-mismatch"].includes(error.message)));
    /** Concurrent successful/suppressed delivery always wins over failure bookkeeping. */
    const recorded = await db.runTransaction(async (transaction) => {
      /** Provides current behavior. */
      const current = await transaction.get(eventRef);
      if (!current.exists || current.data()?.delivered === true) return false;
      if (!permanent) {
        if (current.data()!.nextAttemptAtMs > nowMs) return false;
        /** Invalid historical counters cannot produce unbounded exponentiation. */
        const attempts = Math.min(20, Math.max(0, Math.trunc(Number(current.data()?.deliveryAttempts) || 0)) + 1);
        transaction.update(eventRef, {deliveryState: "pending", deliveryAttempts: attempts, lastFailureAtMs: nowMs,
          lastFailureCode: error instanceof HttpsError ? error.code : "unavailable",
          nextAttemptAtMs: raceDeliveryRetryAt(eventRef.id, attempts, nowMs)});
        return true;
      }
      // delivered is a processing receipt, also used for suppressed events.
      // quarantined distinguishes failure from actual inbox/profile delivery.
      transaction.update(eventRef, {delivered: true, deliveryState: "quarantined", quarantined: true, quarantinedAtMs: nowMs,
        failureCode: "data-loss", nextAttemptAtMs: admin.firestore.FieldValue.delete()});
      return true;
    });
    if (!permanent) throw error;
    if (recorded) logger.write({severity: "ERROR", message: "Race delivery requires repair and replay", collection: eventRef.parent.id, eventId: eventRef.id, failureCode: "data-loss"});
    return false;
  }
}
