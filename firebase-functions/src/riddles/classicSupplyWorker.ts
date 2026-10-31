import {randomUUID} from "node:crypto";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {admin} from "../shared/firebaseAdmin";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {captureException} from "../shared/sentry";
import {RIDDLE_GENERATION_BATCH_SIZE} from "../shared/constants";
import {generateLocalizedClassicRiddlesForLocale} from "./riddleGeneration";

/** Lease outlives the worker timeout; crashed invocations become eligible again. */
const LEASE_MS = 10 * 60000;
/** An attempt may spend up to three further sixty-second model calls after this deadline. */
const GENERATION_BUDGET_MS = 3 * 60000;
/** Backoff avoids spinning on a provider outage. */
const RETRY_MS = 5 * 60000;

/** Claims a durable request transactionally so overlapping scheduled invocations cannot generate twice. */
export async function processClassicSupplyJob(requestId: string): Promise<"skipped" | "generated" | "retry"> {
  /** Firestore owns the durable generation request and retry lease. */
  const db = admin.firestore();
  /** Stable job document survives worker retries and crashes. */
  const ref = db.collection("classicSupplyJobs").doc(requestId);
  /** Invocation identity prevents an expired worker from settling a newer lease. */
  const leaseId = randomUUID();
  /** Claim time defines lease eligibility and the generation deadline. */
  const now = Date.now();
  /** Validated locale is returned only after this invocation acquires the job lease. */
  const locale = await db.runTransaction(async transaction => {
    /** Each attempt locks the canonical job and loads only its eligibility and locale inputs. */
    const [snapshot] = await transaction.getAll(ref, {fieldMask: ["nextAttemptAtMs", "completed", "locale"]});
    /** Persisted completion and retry fields determine whether the job can run. */
    const data = snapshot?.data();
    if (!data || data.nextAttemptAtMs > now || data.completed === true) return undefined;
    if (!SUPPORTED_LOCALES.includes(data.locale)) throw new Error("Invalid Classic supply job locale.");
    transaction.update(ref, {leaseId, nextAttemptAtMs: now + LEASE_MS});
    return data.locale as SupportedLocale;
  });
  if (!locale) return "skipped";
  /** Generation outcome controls completion or delayed retry. */
  let succeeded = false;
  try {
    await generateLocalizedClassicRiddlesForLocale(locale, RIDDLE_GENERATION_BATCH_SIZE, now + GENERATION_BUDGET_MS);
    succeeded = true;
  } catch (error) {
    captureException(error, {operation: "classicSupplyJob", locale});
  }
  await db.runTransaction(async transaction => {
    /** This attempt locks the canonical job and loads only its current lease owner before recording an outcome. */
    const [snapshot] = await transaction.getAll(ref, {fieldMask: ["leaseId"]});
    /** Missing or superseded jobs cannot be recreated or settled by this invocation. */
    const current = snapshot?.data();
    if (current?.leaseId !== leaseId) return;
    transaction.update(ref, succeeded
      ? {completed: true, nextAttemptAtMs: Number.MAX_SAFE_INTEGER}
      : {nextAttemptAtMs: Date.now() + RETRY_MS});
  });
  return succeeded ? "generated" : "retry";
}

/** Three bounded jobs per invocation; one indexed field covers both retry and expired-lease eligibility. */
export async function processClassicSupplyJobs(): Promise<void> {
  /** Discovery needs only due document IDs; claim transactions independently read current eligibility and locale. */
  const due = await admin.firestore().collection("classicSupplyJobs")
    .where("nextAttemptAtMs", "<=", Date.now()).orderBy("nextAttemptAtMs").limit(3).select().get();
  await Promise.all(due.docs.map(document => processClassicSupplyJob(document.id)));
}

/** Processes a player-created supply request without polling an idle queue. */
export async function handleClassicSupplyRequest(requestId: string): Promise<void> {
  await processClassicSupplyJob(requestId);
  /** Persisted completion state after the worker attempt. */
  const current = await admin.firestore().collection("classicSupplyJobs").doc(requestId).get();
  if (current.exists && current.data()?.completed !== true) throw new Error("Classic supply request remains pending.");
}

/** Event retries recover provider failures and expired leases only for an existing request. */
export const replenishClassicSupplyOnDemand = onDocumentCreated({
  document: "classicSupplyJobs/{requestId}", region: "us-central1", minInstances: 0,
  timeoutSeconds: 540, secrets: ["OPENAI_API_KEY"], retry: true,
}, async event => {await handleClassicSupplyRequest(event.params.requestId);});

/** Only an explicit player-triggered reactivation restarts an expired event retry window. */
export const retryClassicSupplyOnDemand = onDocumentUpdated({
  document: "classicSupplyJobs/{requestId}", region: "us-central1", minInstances: 0,
  timeoutSeconds: 540, secrets: ["OPENAI_API_KEY"], retry: true,
}, async event => {
  if (event.data?.before.data()?.requeuedAtMs === event.data?.after.data()?.requeuedAtMs) return;
  await handleClassicSupplyRequest(event.params.requestId);
});
