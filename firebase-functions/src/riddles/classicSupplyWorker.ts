import {randomUUID} from "node:crypto";
import * as functions from "firebase-functions";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {admin} from "../shared/firebaseAdmin";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {captureException} from "../shared/sentry";
import {RIDDLE_GENERATION_BATCH_SIZE} from "../shared/constants";
import {generateLocalizedClassicRiddlesForLocale} from "./riddleGeneration";

/** Lease outlives the worker timeout; crashed invocations become eligible again. */
const LEASE_MS = 10 * 60000;
/** An attempt may spend up to three further sixty-second model calls after this deadline. */
const GENERATION_BUDGET_MS = 3 * 60000;
/** Backoff avoids spinning on a provider outage. */
const RETRY_MS = 5 * 60000;
/** Consecutive transient provider failures tolerated before an outage is reported. */
export const TRANSIENT_REPORT_THRESHOLD = 3;

/**
 * Identifies provider failures that a delayed retry is expected to resolve.
 *
 * @param error Failure thrown by riddle generation.
 * @returns True for rate limits, provider 5xx responses, conflicts, timeouts and dropped connections.
 */
export function isTransientProviderError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  /** HTTP status reported by the provider SDK, when present. */
  const status = (error as {/** Provider HTTP status. */ status?: unknown}).status;
  if (typeof status === "number") return status === 408 || status === 409 || status === 429 || status >= 500;
  /** SDK and runtime error class names for network-level failures. */
  const name = (error as {/** Error class name. */ name?: unknown}).name;
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError" ||
    name === "AbortError" || name === "TimeoutError";
}

/** Claims a durable request transactionally so overlapping scheduled invocations cannot generate twice. */
export async function processClassicSupplyJob(requestId: string): Promise<"skipped" | "generated" | "retry"> {
  /** Firestore owns the durable generation request and retry lease. */
  const db = admin.firestore();
  /** Stable job document survives worker retries and crashes. */
  const ref = db.collection("classicSupplyJobs").doc(requestId);
  /** Invocation identity prevents an expired worker from settling a newer lease. */
  const leaseId = randomUUID();
  /** Consecutive transient failures recorded before this attempt. */
  let priorTransientFailures = 0;
  /** Claim time defines lease eligibility and the generation deadline. */
  const now = Date.now();
  /** Validated locale is returned only after this invocation acquires the job lease. */
  const locale = await db.runTransaction(async transaction => {
    /** Each attempt locks the canonical job and loads only its eligibility and locale inputs. */
    const [snapshot] = await transaction.getAll(ref, {fieldMask: ["nextAttemptAtMs", "completed", "locale", "transientFailures"]});
    /** Persisted completion and retry fields determine whether the job can run. */
    const data = snapshot?.data();
    if (!data || data.nextAttemptAtMs > now || data.completed === true) return undefined;
    if (!SUPPORTED_LOCALES.includes(data.locale)) throw new Error("Invalid Classic supply job locale.");
    transaction.update(ref, {leaseId, nextAttemptAtMs: now + LEASE_MS});
    priorTransientFailures = typeof data.transientFailures === "number" ? data.transientFailures : 0;
    return data.locale as SupportedLocale;
  });
  if (!locale) return "skipped";
  /** Generation outcome controls completion or delayed retry. */
  let succeeded = false;
  /** Whether this attempt failed with a provider error that a retry should resolve. */
  let transient = false;
  try {
    await generateLocalizedClassicRiddlesForLocale(locale, RIDDLE_GENERATION_BATCH_SIZE, now + GENERATION_BUDGET_MS);
    succeeded = true;
  } catch (error) {
    transient = isTransientProviderError(error);
    if (transient && priorTransientFailures + 1 < TRANSIENT_REPORT_THRESHOLD) {
      functions.logger.warn("Classic supply generation deferred after a transient provider failure", {
        locale, consecutiveFailures: priorTransientFailures + 1,
      });
    } else {
      captureException(error, {operation: "classicSupplyJob", locale, consecutiveTransientFailures: transient ? priorTransientFailures + 1 : 0});
    }
  }
  await db.runTransaction(async transaction => {
    /** This attempt locks the canonical job and loads only its current lease owner before recording an outcome. */
    const [snapshot] = await transaction.getAll(ref, {fieldMask: ["leaseId"]});
    /** Missing or superseded jobs cannot be recreated or settled by this invocation. */
    const current = snapshot?.data();
    if (current?.leaseId !== leaseId) return;
    transaction.update(ref, succeeded
      ? {completed: true, nextAttemptAtMs: Number.MAX_SAFE_INTEGER, transientFailures: 0}
      : {nextAttemptAtMs: Date.now() + RETRY_MS, transientFailures: transient ? priorTransientFailures + 1 : 0});
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

/** Scheduled retries also recover requests whose original worker died or timed out. */
export const replenishClassicSupply = onScheduleWithSentry("replenishClassicSupply", {
  schedule: "every 1 minutes", timeZone: "UTC", region: "us-central1",
  timeoutSeconds: 540, secrets: ["OPENAI_API_KEY"],
}, async () => {await processClassicSupplyJobs();});
