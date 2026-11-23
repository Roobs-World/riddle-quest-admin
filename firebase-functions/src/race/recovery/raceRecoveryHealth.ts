import {admin} from "../../shared/firebaseAdmin";
import type {Firestore} from "../raceSetupService";
import {RACE_DELIVERY_QUEUES, type RaceDeliveryQueueName} from "../delivery/raceDeliveryQueue";

/** Operational sampling stays bounded independently of traffic or an outage backlog. */
export const RACE_RECOVERY_HEALTH_SAMPLE = 20;
/** Deadlines should normally settle within two one-minute worker invocations. */
export const RACE_DEADLINE_DELAY_WARNING_MS = 120000;
/** Outbox delivery older than five minutes requires investigation. */
export const RACE_OUTBOX_DELAY_WARNING_MS = 300000;
/** Recovery checkpoints with pending work should advance at least every ten minutes. */
export const RACE_RECOVERY_STALE_MS = 600000;
/** Full reconciliation cycles have a separate diagnostic threshold from page progress. */
export const RACE_PROJECTION_CYCLE_WARNING_MS = 3600000;

/** One extra document distinguishes an exhausted sample from a larger queue. */
type Sample = {
  /** Exact within this query when uncapped; otherwise a lower bound. */ lowerBound: number;
  /** More than the configured sample size was observed. */ capped: boolean;
};
/** Outbox state is reported independently of worker leases and success logs. */
type OutboxHealth = {
  /** Pending receipts, including those lacking an enqueue-time ordering field. */ pending: Sample;
  /** Permanent corruption remains visible after processing acknowledgement. */ quarantined: Sample;
  /** Original globally oldest indexed enqueue time; backoff cannot reset age. */ oldestPendingAgeMs: number;
  /** Malformed clocks in the unordered pending sample require repair. */ invalidEnqueueTimesInSample: number;
  /** Pending old work with no recent recovery checkpoint. */ recoveryStale: boolean;
};
/** Answer-free recovery diagnostics with explicit bounded-sample semantics. */
export type RaceRecoveryHealth = {
  /** Authoritative observation time shared across all sampled queries. */ observedAtMs: number;
  /** Due wake-ups and retained original deadline diagnostics are separate facts. */ deadlines: {
    /** Currently due indexed worker wake-ups. */ due: Sample;
    /** Delay of the globally oldest currently due wake-up. */ oldestWakeDelayMs: number;
    /** Active records retaining retry history, including deferred and quarantined work. */ retried: Sample;
    /** Original scoring deadline age within the bounded retry sample. */ oldestOriginalDeadlineAgeInSampleMs: number;
    /** Deferred wake-ups within the bounded retry sample. */ deferredInSample: number;
    /** Quarantined diagnostic receipts, independently of the scheduling index. */ quarantined: Sample;
  };
  /** Creator and owner-performance queues remain separately observable. */ outboxes: Record<RaceDeliveryQueueName, OutboxHealth>;
  /** Projection diagnostics share the recovery observation clock without scanning candidate pools. */ projections: {
    /** Explicit maintenance opt-in; disabled jobs are never called stalled. */ enabled: boolean;
    /** Time since the last committed page; null means unknown or invalid. */ lastPageAgeMs: number | null;
    /** Time since a complete canonical and candidate pass; null means unobserved. */ lastCycleAgeMs: number | null;
    /** Invalid source records encountered so far in this cycle; not a population count. */ unavailableInCurrentCycle: number | null;
    /** Unavailable observations in the most recent complete cycle. */ unavailableInLastCycle: number | null;
    /** Enabled work has no valid recent committed page. */ recoveryStale: boolean;
    /** Current checkpoint retains a failed page until successful replay. */ pageFailed: boolean;
  };
  /** Stable problem codes contain no answer, profile, account or event payload. */ warnings: string[];
};

/** Converts bounded query size into a count without claiming a full backlog scan. */
const sampleCount = (page: FirebaseFirestore.QuerySnapshot): Sample => ({lowerBound: Math.min(page.size, RACE_RECOVERY_HEALTH_SAMPLE),
  capped: page.size > RACE_RECOVERY_HEALTH_SAMPLE});
/** Invalid clocks cannot produce misleading negative, NaN or infinite operational ages. */
const age = (nowMs: number, timestamp: unknown): number => typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0 ? Math.max(0, nowMs - timestamp) : 0;

/** Reads bounded queue health without delivering, settling, repairing or extending retained data. */
export async function readRaceRecoveryHealth(db: Firestore = admin.firestore(), nowMs = Date.now()): Promise<RaceRecoveryHealth> {
  /** Active status filtering excludes historical completed runs that retain retry diagnostics. */
  const active = db.collection("raceRuns").where("status", "in", ["prepared", "scheduled", "active"]);
  /** Independent bounded queries retain visibility when the delivery worker cannot run. */
  const [due, retried, quarantined, outboxes, projectionConfig, projectionState] = await Promise.all([
    active.where("deadlineAtMs", "<=", nowMs).orderBy("deadlineAtMs").limit(RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
    active.where("deadlineRecovery.originalDeadlineAtMs", "<=", nowMs).orderBy("deadlineRecovery.originalDeadlineAtMs").limit(RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
    db.collection("raceDeadlineFailures").where("state", "==", "quarantined").limit(RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
    Promise.all(RACE_DELIVERY_QUEUES.map(async collection => {
      /** The unordered sample includes corrupt/missing enqueue clocks omitted by an ordered query. */
      const pendingQuery = db.collection(collection).where("delivered", "==", false);
      /** Globally oldest age and checkpoint state are measured separately from the bounded count. */
      const [pending, head, corrupt, checkpoint] = await Promise.all([
        pendingQuery.limit(RACE_RECOVERY_HEALTH_SAMPLE + 1).get(), pendingQuery.orderBy("createdAtMs").limit(1).get(),
        db.collection(collection).where("quarantined", "==", true).limit(RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
        db.doc(`raceMaintenance/${collection}Recovery`).get(),
      ]);
      /** Missing checkpoint is stale only when pending age exceeds the recovery allowance. */
      const oldestPendingAgeMs = age(nowMs, head.docs[0]?.data().createdAtMs);
      /** A corrupt checkpoint clock never suppresses a stale-work alert. */
      const lastCompletedAtMs = checkpoint.data()?.lastCompletedAtMs;
      /** Counts malformed records without copying their identities into operational output. */
      const invalidEnqueueTimesInSample = pending.docs.filter(document => !Number.isSafeInteger(document.data().createdAtMs) || document.data().createdAtMs < 0).length;
      /** Original age prevents a future retry time from concealing stalled processing. */
      const recoveryStale = pending.size > 0 && oldestPendingAgeMs >= RACE_RECOVERY_STALE_MS &&
        (!Number.isFinite(lastCompletedAtMs) || lastCompletedAtMs > nowMs || nowMs - lastCompletedAtMs >= RACE_RECOVERY_STALE_MS);
      return [collection, {pending: sampleCount(pending), quarantined: sampleCount(corrupt), oldestPendingAgeMs,
        invalidEnqueueTimesInSample, recoveryStale}] as const;
    })),
    db.doc("raceConfig/maintenance").get(),
    db.doc("raceMaintenance/projectionReconciliation").get(),
  ]);
  /** Invalid/future clocks stay unknown rather than looking like fresh successful work. */
  const observedAge = (timestamp: unknown): number | null => Number.isSafeInteger(timestamp) && (timestamp as number) >= 0 && (timestamp as number) <= nowMs
    ? nowMs - (timestamp as number) : null;
  /** Reported counts describe observations only, without copying cursor or document identities. */
  const observedCount = (count: unknown): number | null => Number.isSafeInteger(count) && (count as number) >= 0 ? count as number : null;
  /** Only allowlisted operational facts leave the private checkpoint. */
  const checkpoint = projectionState.data();
  /** Explicitly disabled reconciliation may legitimately have no checkpoint. */
  const enabled = projectionConfig.data()?.projectionReconciliationEnabled === true;
  /** Original page completion clock is independent of lease renewals and failed retries. */
  const lastPageAgeMs = observedAge(checkpoint?.lastCompletedAtMs);
  /** A recent page does not establish that both complete passes are keeping up. */
  const lastCycleAgeMs = observedAge(checkpoint?.lastCycleCompletedAtMs);
  /** Previous complete-cycle corruption survives later successful individual pages. */
  const projections = {enabled, lastPageAgeMs, lastCycleAgeMs,
    unavailableInCurrentCycle: observedCount(checkpoint?.cycleUnavailable),
    unavailableInLastCycle: observedCount(checkpoint?.lastCycleUnavailable),
    recoveryStale: enabled && (lastPageAgeMs === null || lastPageAgeMs >= RACE_RECOVERY_STALE_MS),
    pageFailed: typeof checkpoint?.lastFailureCode === "string" && checkpoint.lastFailureCode.length > 0};
  /** Due wake-up delay does not substitute for original scoring delay during retries. */
  const deadlines = {due: sampleCount(due), oldestWakeDelayMs: age(nowMs, due.docs[0]?.data().deadlineAtMs),
    retried: sampleCount(retried), oldestOriginalDeadlineAgeInSampleMs: Math.max(0, ...retried.docs.map(document => age(nowMs, document.data().deadlineRecovery?.originalDeadlineAtMs))),
    deferredInSample: retried.docs.filter(document => document.data().deadlineAtMs > nowMs).length, quarantined: sampleCount(quarantined)};
  /** Structured codes make alert filters stable while retaining bounded metric cardinality. */
  const warnings: string[] = [];
  if (projections.recoveryStale) warnings.push("projections-recovery-stale");
  if (enabled && lastCycleAgeMs === null) warnings.push("projections-cycle-unobserved");
  if (enabled && lastCycleAgeMs !== null && lastCycleAgeMs >= RACE_PROJECTION_CYCLE_WARNING_MS) warnings.push("projections-cycle-delay");
  if (projections.pageFailed) warnings.push("projections-page-failed");
  if ((projections.unavailableInCurrentCycle ?? 0) > 0 || (projections.unavailableInLastCycle ?? 0) > 0) warnings.push("projections-unavailable-sources");
  if (deadlines.oldestWakeDelayMs >= RACE_DEADLINE_DELAY_WARNING_MS) warnings.push("deadlines-overdue");
  if (deadlines.oldestOriginalDeadlineAgeInSampleMs >= RACE_OUTBOX_DELAY_WARNING_MS) warnings.push("deadline-retry-delay");
  if (deadlines.quarantined.lowerBound > 0) warnings.push("deadlines-quarantined");
  for (const [collection, report] of outboxes) {
    if (report.oldestPendingAgeMs >= RACE_OUTBOX_DELAY_WARNING_MS) warnings.push(`${collection}-delivery-delay`);
    if (report.quarantined.lowerBound > 0) warnings.push(`${collection}-quarantined`);
    if (report.invalidEnqueueTimesInSample > 0) warnings.push(`${collection}-invalid-enqueue-time`);
    if (report.recoveryStale) warnings.push(`${collection}-recovery-stale`);
  }
  return {observedAtMs: nowMs, deadlines, outboxes: Object.fromEntries(outboxes) as Record<RaceDeliveryQueueName, OutboxHealth>, projections, warnings};
}
