import {randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {migrateRaceArchitecturePage, reconcileRaceChallenge, type RaceMigrationReport} from "./raceArchitectureMigration";
import type {Firestore} from "./raceSetupService";

/** Lease outlasts the scheduled invocation timeout, then permits recovery after a crash. */
export const RACE_RECONCILIATION_LEASE_MS = 5 * 60000;
/** Two bounded passes repair missing projections and remove source-less projections. */
type Phase = "challenges" | "candidates";
/** Claimed page belongs to one worker; replay after interruption is idempotent. */
type Claim = {
  /** Canonical or derived collection pass. */ phase: Phase;
  /** Last completed document in this pass. */ afterId?: string;
  /** Worker allowed to advance this checkpoint. */ leaseId: string;
};
/** One bounded operator page; mutation requires an explicit false dry-run flag. */
type CandidatePage = {
  /** Last successfully processed projection ID. */ afterId?: string;
  /** Source records per page, from one to one hundred. */ limit?: number;
  /** Defaults to true for operator inspection. */ dryRun?: boolean;
};
/** Operational status is separate from per-record projection eligibility. */
type ReconciliationResult = {
  /** Whether configuration/lease permitted processing and checkpoint commitment. */ status: "disabled" | "leased" | "processed" | "superseded";
  /** Bounded record counts only, without canonical content. */ report?: RaceMigrationReport;
};

/** Reconciles one ID-ordered projection page against canonical archives without reading the mutable catalog. */
export async function reconcileRaceCandidatePage(db: Firestore,
  input: CandidatePage = {}, nowMs = Date.now()): Promise<RaceMigrationReport> {
  /** Fixed source-record bound also bounds transactions and writes. */
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpsError("invalid-argument", "Reconciliation page size must be between 1 and 100.");
  /** Complete document IDs make pagination stable across expiration changes. */
  let query = db.collection("raceMatchCandidates").orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
  if (input.afterId) query = query.startAfter(input.afterId);
  /** Snapshot IDs remain usable when the corresponding projection is removed. */
  const page = await query.get();
  /** Full pages require another lookup; empty pages finish the pass. */
  const report: RaceMigrationReport = {scanned: page.size, changed: 0, unavailable: 0, skipped: 0,
    ...(page.size ? {nextAfterId: page.docs.at(-1)!.id} : {}), complete: page.size < limit};
  for (const document of page.docs) {
    /** Fresh transactional source reads prevent deletion/publication races from recreating stale data. */
    const result = await db.runTransaction(tx => reconcileRaceChallenge(tx, db,
      db.doc(`raceChallenges/${document.id}`), input.dryRun !== false, nowMs));
    report[result]++;
  }
  return report;
}

/** Claims one maintenance page; disabled by default until index deployment/backfill checks are complete. */
export async function processRaceProjectionReconciliation(db: Firestore = admin.firestore(), nowMs = Date.now(), limit = 100): Promise<ReconciliationResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpsError("invalid-argument", "Reconciliation page size must be between 1 and 100.");
  /** Server-only configuration does not grant multiplayer capabilities to unsupported targets. */
  const config = db.doc("raceConfig/maintenance");
  /** Durable checkpoint survives a failed or interrupted invocation. */
  const stateRef = db.doc("raceMaintenance/projectionReconciliation");
  /** Worker identity protects checkpoint writes from an expired lease owner. */
  const leaseId = randomUUID();
  /** Acquisition reads precede all writes and never advances the cursor. */
  const acquisition = await db.runTransaction(async tx => {
    /** Maintenance opt-in and current lease are checked atomically. */
    const [configuration, state] = await Promise.all([tx.get(config), tx.get(stateRef)]);
    if (configuration.data()?.projectionReconciliationEnabled !== true) return "disabled" as const;
    /** Invalid/expired leases cannot permanently stall the job. */
    const current = state.data();
    if (typeof current?.leaseUntilMs === "number" && current.leaseUntilMs > nowMs) return "leased" as const;
    /** Supported checkpoint phases are normalized; unknown phases safely restart the canonical pass. */
    const phase: Phase = current?.phase === "candidates" ? "candidates" : "challenges";
    /** Cursor is a single document ID rather than an executable query or path. */
    const afterId = typeof current?.afterId === "string" && current.afterId.length > 0 && !current.afterId.includes("/")
      ? current.afterId : undefined;
    tx.set(stateRef, {phase, afterId: afterId ?? null, leaseId, leaseUntilMs: nowMs + RACE_RECONCILIATION_LEASE_MS,
      ...(phase === "challenges" && afterId === undefined ? {cycleStartedAtMs: nowMs, cycleUnavailable: 0} : {})}, {merge: true});
    return {phase, afterId, leaseId} satisfies Claim;
  });
  if (typeof acquisition === "string") return {status: acquisition};
  try {
    /** Both passes reuse the same archive/privacy/eligibility projection implementation. */
    const report = acquisition.phase === "challenges"
      ? await migrateRaceArchitecturePage(db, {collection: "challenges", afterId: acquisition.afterId, limit, dryRun: false}, nowMs)
      : await reconcileRaceCandidatePage(db, {afterId: acquisition.afterId, limit, dryRun: false}, nowMs);
    /** Checkpoint advances only after every record succeeds and this lease still belongs to us. */
    const committed = await db.runTransaction(async tx => {
      /** A superseded worker may finish idempotent repairs but cannot overwrite a newer cursor. */
      const current = await tx.get(stateRef);
      if (current.data()?.leaseId !== leaseId) return false;
      /** Page totals accumulate through both passes, so healthy later pages cannot hide corruption. */
      const previousUnavailable = current.data()?.cycleUnavailable;
      /** Legacy or invalid counters conservatively restart accumulation at this page. */
      const cycleUnavailable = (Number.isSafeInteger(previousUnavailable) && previousUnavailable >= 0 ? previousUnavailable : 0) + report.unavailable;
      /** A legacy partial checkpoint cannot establish that a complete canonical pass was observed. */
      const cycleStartedAtMs = current.data()?.cycleStartedAtMs;
      /** Complete-cycle attribution begins only at a trustworthy canonical-pass start. */
      const completedCycle = report.complete && acquisition.phase === "candidates" &&
        Number.isSafeInteger(cycleStartedAtMs) && cycleStartedAtMs >= 0 && cycleStartedAtMs <= nowMs;
      tx.update(stateRef, {phase: report.complete ? acquisition.phase === "challenges" ? "candidates" : "challenges" : acquisition.phase,
        afterId: report.complete ? null : report.nextAfterId ?? acquisition.afterId ?? null,
        leaseId: null, leaseUntilMs: 0, lastCompletedAtMs: nowMs, lastReport: report, lastFailureCode: null,
        cycleUnavailable,
        ...(completedCycle ? {lastCycleCompletedAtMs: nowMs, lastCycleUnavailable: cycleUnavailable} : {})});
      return true;
    });
    logger.info("Race projection reconciliation", {phase: acquisition.phase, status: committed ? "processed" : "superseded", ...report});
    return {status: committed ? "processed" : "superseded", report};
  } catch (error) {
    // Keep the prior cursor for safe replay. Failure to release leaves the
    // bounded lease in place; a later invocation recovers after it expires.
    await db.runTransaction(async tx => {
      /** Only the current worker can release its checkpoint lease. */
      const current = await tx.get(stateRef);
      if (current.data()?.leaseId === leaseId) tx.update(stateRef, {leaseId: null, leaseUntilMs: 0,
        lastFailureAtMs: nowMs, lastFailureCode: error instanceof HttpsError ? error.code : "internal"});
    });
    throw error;
  }
}
