import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../shared/firebaseAdmin";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {settleRaceRun} from "./raceSettlement";
import {deliverRaceSettlement} from "./raceSettlementDelivery";
import {parseRunRecord, type Firestore} from "./raceSetupService";

/** Bounded page size for unattended race settlement and missed event delivery. */
export const RACE_SETTLEMENT_JOB_LIMIT = 100;

/** Settles due runs and retries pending outbox events without scanning all players. */
export async function processRaceSettlementJobs(db: Firestore = admin.firestore(), nowMs = Date.now()): Promise<void> {
  const due = await db.collection("raceRuns").where("status", "==", "active")
    .where("deadlineAtMs", "<=", nowMs).orderBy("deadlineAtMs").limit(RACE_SETTLEMENT_JOB_LIMIT).get();
  // Bounded concurrency prevents one popular creator or retry wave overwhelming storage.
  for (let offset = 0; offset < due.docs.length; offset += 10) {
    await Promise.all(due.docs.slice(offset, offset + 10).map((document) => db.runTransaction(async (transaction) => {
      const current = await transaction.get(document.ref);
      if (!current.exists) return;
      await settleRaceRun(transaction, db, parseRunRecord(current.data()), nowMs);
    })));
  }
  const pending = await db.collection("raceSettlementOutbox").where("delivered", "==", false)
    .orderBy("createdAtMs").limit(RACE_SETTLEMENT_JOB_LIMIT).get();
  for (let offset = 0; offset < pending.docs.length; offset += 10) {
    await Promise.all(pending.docs.slice(offset, offset + 10).map((document) => deliverRaceSettlement(document.id, db, nowMs)));
  }
}

/** Retry-enabled delivery of a committed creator settlement event. */
export const deliverRaceSettlementEvent = onDocumentCreated({
  document: "raceSettlementOutbox/{runId}", region: "us-central1", retry: true,
}, async (event) => {await deliverRaceSettlement(event.params.runId);});

/** Resolves closed-browser race deadlines and recovers undelivered outbox events. */
export const settleRaceDeadlines = onScheduleWithSentry("settleRaceDeadlines", {
  schedule: "every 1 minutes", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
}, async () => {await processRaceSettlementJobs();});
