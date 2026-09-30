import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {processRaceDeadline} from "./raceDeadlineRecovery";
import {deliverRaceSettlement} from "./raceSettlementDelivery";
import {deliverRacePerformance} from "./racePerformanceDelivery";
import {type Firestore} from "./raceSetupService";
import {processRaceDeliveryQueue} from "./raceDeliveryQueue";

/** Isolates a transient failure to its own record while preserving retry eligibility for the next invocation. */
async function settleBatch(operations: Promise<unknown>[], kind: string): Promise<void> {
  /** Provides results behavior. */
  const results = await Promise.allSettled(operations);
  /** Provides failed behavior. */
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) logger.error("Race background batch has retryable failures", {kind, failed, examined: results.length});
}

/** Bounded page size for unattended race settlement and missed event delivery. */
export const RACE_SETTLEMENT_JOB_LIMIT = 100;

/** Settles due runs and retries pending outbox events without scanning all players. */
export async function processRaceSettlementJobs(db: Firestore = admin.firestore(), nowMs = Date.now()): Promise<void> {
  /** Provides due behavior. */
  const due = await db.collection("raceRuns").where("status", "in", ["prepared", "scheduled", "active"])
    .where("deadlineAtMs", "<=", nowMs).orderBy("deadlineAtMs").limit(RACE_SETTLEMENT_JOB_LIMIT).get();
  // Bounded concurrency prevents one popular creator or retry wave overwhelming storage.
  for (let offset = 0; offset < due.docs.length; offset += 10) {
    await settleBatch(due.docs.slice(offset, offset + 10).map((document) => processRaceDeadline(db, document.ref, nowMs)), "deadlines");
  }
  await settleBatch([
    processRaceDeliveryQueue(db, "raceSettlementOutbox", id => deliverRaceSettlement(id, db, nowMs), nowMs),
    processRaceDeliveryQueue(db, "racePerformanceOutbox", id => deliverRacePerformance(id, db, nowMs), nowMs),
  ], "delivery-queues");
}

/** Retry-enabled delivery of a committed creator settlement event. */
export const deliverRaceSettlementEvent = onDocumentCreated({
  document: "raceSettlementOutbox/{runId}", region: "us-central1", retry: true,
}, async (event) => {await deliverRaceSettlement(event.params.runId);});

/** Retry-enabled owner-only performance projection; recording popularity never updates the creator repeatedly. */
export const deliverRacePerformanceEvent = onDocumentCreated({document: "racePerformanceOutbox/{runId}", region: "us-central1", retry: true},
  async (event) => {await deliverRacePerformance(event.params.runId);});

/** Resolves closed-browser race deadlines and recovers undelivered outbox events. */
export const settleRaceDeadlines = onScheduleWithSentry("settleRaceDeadlines", {
  schedule: "every 1 minutes", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
}, async () => {await processRaceSettlementJobs();});
