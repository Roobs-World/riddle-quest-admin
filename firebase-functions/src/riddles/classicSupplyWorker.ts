import {randomUUID} from "node:crypto";
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
    /** Current job state is read before eligibility and locale checks. */
    const snapshot = await transaction.get(ref);
    /** Persisted completion and retry fields determine whether the job can run. */
    const data = snapshot.data();
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
    /** Latest lease owner must still match before the worker records its outcome. */
    const current = (await transaction.get(ref)).data();
    if (current?.leaseId !== leaseId) return;
    transaction.update(ref, succeeded
      ? {completed: true, nextAttemptAtMs: Number.MAX_SAFE_INTEGER}
      : {nextAttemptAtMs: Date.now() + RETRY_MS});
  });
  return succeeded ? "generated" : "retry";
}

/** Three bounded jobs per invocation; one indexed field covers both retry and expired-lease eligibility. */
export async function processClassicSupplyJobs(): Promise<void> {
  /** Bounded indexed query finds eligible retries and expired leases. */
  const due = await admin.firestore().collection("classicSupplyJobs")
    .where("nextAttemptAtMs", "<=", Date.now()).orderBy("nextAttemptAtMs").limit(3).get();
  await Promise.all(due.docs.map(document => processClassicSupplyJob(document.id)));
}

/** Scheduled retries also recover requests whose original worker died or timed out. */
export const replenishClassicSupply = onScheduleWithSentry("replenishClassicSupply", {
  schedule: "every 1 minutes", timeZone: "UTC", region: "us-central1",
  timeoutSeconds: 540, secrets: ["OPENAI_API_KEY"],
}, async () => {await processClassicSupplyJobs();});
