import {randomUUID} from "node:crypto";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import type {Firestore} from "./raceSetupService";

/** Queue names are fixed server-owned collections, never caller-supplied paths. */
export const RACE_DELIVERY_QUEUES = ["raceSettlementOutbox", "racePerformanceOutbox"] as const;
/** Creator rewards and owner-only performance use the same recovery interface. */
export type RaceDeliveryQueueName = typeof RACE_DELIVERY_QUEUES[number];
/** Recovery pages remain bounded even when every event fails. */
export const RACE_DELIVERY_PAGE_SIZE = 100;
/** Lease exceeds the scheduled invocation timeout and permits crash recovery. */
export const RACE_DELIVERY_LEASE_MS = 300000;
/** Sustained pending age requires operational attention, independently of retry time. */
export const RACE_DELIVERY_AGE_WARNING_MS = 300000;
/** Stable cursor resolves equal timestamps and survives removal of its previous document. */
type DeliveryCursor = {
  /** Original enqueue time is never rewritten for retry scheduling. */ createdAtMs: number;
  /** Opaque event document ID, including legacy run IDs. */ id: string;
};
/** Operational page measurements describe attempted work, not reward authority. */
export type RaceDeliveryQueueReport = {
  /** Whether this worker owned and committed the recovery cursor. */ status: "leased" | "processed" | "superseded";
  /** Pending documents retrieved by the circular page. */ scanned: number;
  /** Adapter acknowledgements that produced a new downstream effect. */ delivered: number;
  /** Documents whose persisted retry time has not arrived. */ deferred: number;
  /** Adapter failures isolated to their own receipt. */ failed: number;
  /** Full sample is a lower bound, not an exact backlog count. */ sampleCapped: boolean;
  /** Age of the globally oldest pending receipt before processing, including backoff. */ oldestPendingAgeMs: number;
};

/** Rotates bounded retry pages so persistent failures cannot monopolize the oldest-first queue. */
export async function processRaceDeliveryQueue(db: Firestore, collection: RaceDeliveryQueueName,
  deliver: (eventId: string) => Promise<boolean>, nowMs: number, limit = RACE_DELIVERY_PAGE_SIZE): Promise<RaceDeliveryQueueReport> {
  if (!RACE_DELIVERY_QUEUES.includes(collection) || !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > Number.MAX_SAFE_INTEGER - RACE_DELIVERY_LEASE_MS || !Number.isInteger(limit) || limit < 1 || limit > RACE_DELIVERY_PAGE_SIZE)
    throw new HttpsError("invalid-argument", "Invalid race delivery queue or page size.");
  /** Queue checkpoint contains no owner identity or copied provider payload. */
  const stateRef = db.doc(`raceMaintenance/${collection}Recovery`);
  /** Worker identity guards the final checkpoint from a stale invocation. */
  const leaseId = randomUUID();
  /** Claiming a lease does not advance the prior cursor. */
  const acquisition = await db.runTransaction(async tx => {
    /** Only one recovery invocation may own a queue cursor at a time. */
    const snapshot = await tx.get(stateRef);
    /** Malformed lease clocks cannot permanently lock a queue. */
    const current = snapshot.data();
    if (typeof current?.leaseId === "string" && current.leaseId.trim().length > 0 && current.leaseId.length <= 160 &&
      Number.isSafeInteger(current.leaseUntilMs) && current.leaseUntilMs > nowMs) return null;
    /** Invalid historical cursors safely restart a complete bounded page. */
    const raw = current?.cursor;
    /** Creation and ID are a complete indexed ordering key. */
    const cursor: DeliveryCursor | undefined = Number.isFinite(raw?.createdAtMs) && raw.createdAtMs >= 0 &&
      typeof raw.id === "string" && raw.id.length > 0 && raw.id.length <= 160 && !raw.id.includes("/") ? raw : undefined;
    tx.set(stateRef, {leaseId, leaseUntilMs: nowMs + RACE_DELIVERY_LEASE_MS}, {merge: true});
    return {cursor};
  });
  if (!acquisition) return {status: "leased", scanned: 0, delivered: 0, deferred: 0, failed: 0, sampleCapped: false, oldestPendingAgeMs: 0};
  try {
    /** Explicit document ID ordering makes same-millisecond events unambiguous. */
    const base = db.collection(collection).where("delivered", "==", false).orderBy("createdAtMs")
      .orderBy(admin.firestore.FieldPath.documentId());
    /** The tail is visited before wrapping to older retrying receipts. */
    const tail = acquisition.cursor ? base.startAfter(acquisition.cursor.createdAtMs, acquisition.cursor.id) : base;
    /** One extra head read measures global pending age rather than the rotating sample's age. */
    const [page, head] = await Promise.all([tail.limit(limit).get(), base.limit(1).get()]);
    /** At most one wrap query fills the unused part of this page without duplicating its tail. */
    const documents = [...page.docs];
    if (acquisition.cursor && documents.length < limit) {
      /** Boundary includes the old cursor itself only in the wrapping half. */
      const wrap = await base.endAt(acquisition.cursor.createdAtMs, acquisition.cursor.id).limit(limit - documents.length).get();
      documents.push(...wrap.docs);
    }
    /** Backoff metadata is checked again inside real delivery transactions. */
    const report: RaceDeliveryQueueReport = {status: "processed", scanned: documents.length, delivered: 0, deferred: 0,
      failed: 0, sampleCapped: documents.length === limit,
      oldestPendingAgeMs: Number.isFinite(head.docs[0]?.data().createdAtMs) ? Math.max(0, nowMs - head.docs[0].data().createdAtMs) : 0};
    for (let offset = 0; offset < documents.length; offset += 10) {
      /** Deferred receipts do not issue downstream source/profile reads. */
      const ready = documents.slice(offset, offset + 10).filter(document => {
        if (document.data().nextAttemptAtMs > nowMs) {report.deferred++; return false;}
        return true;
      });
      /** Promise construction isolates even a synchronous adapter failure. */
      const results = await Promise.allSettled(ready.map(document => Promise.resolve().then(() => deliver(document.id))));
      report.failed += results.filter(result => result.status === "rejected").length;
      report.delivered += results.filter(result => result.status === "fulfilled" && result.value).length;
    }
    /** All examined documents advance the cursor, including transient failures and deferred receipts. */
    const last = documents.at(-1);
    /** A partial circle exhausted the current pending pool and can restart from the beginning. */
    const cursor: DeliveryCursor | null = report.sampleCapped && last ? {createdAtMs: last.data().createdAtMs, id: last.id} : null;
    /** Replayed delivery transactions are idempotent, but an old worker cannot overwrite a newer cursor. */
    const committed = await db.runTransaction(async tx => {
      /** Only this worker's current lease can publish its page checkpoint. */
      const current = await tx.get(stateRef);
      if (current.data()?.leaseId !== leaseId) return false;
      tx.update(stateRef, {cursor, leaseId: null, leaseUntilMs: 0, lastCompletedAtMs: nowMs, lastReport: report, lastFailureCode: null});
      return true;
    });
    if (!committed) report.status = "superseded";
    logger.write({severity: report.failed || report.sampleCapped || report.oldestPendingAgeMs >= RACE_DELIVERY_AGE_WARNING_MS ? "WARNING" : "INFO",
      message: "Race delivery queue health", collection, ...report});
    return report;
  } catch (error) {
    /** Preserve the prior cursor when page retrieval/checkpointing fails, enabling idempotent replay. */
    await db.runTransaction(async tx => {
      /** A newer worker owns its own lease and must remain untouched. */
      const current = await tx.get(stateRef);
      if (current.data()?.leaseId === leaseId) tx.update(stateRef, {leaseId: null, leaseUntilMs: 0,
        lastFailureAtMs: nowMs, lastFailureCode: error instanceof HttpsError ? error.code : "unavailable"});
    });
    throw error;
  }
}
