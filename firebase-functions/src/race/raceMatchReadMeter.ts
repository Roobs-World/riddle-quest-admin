import type {Firestore} from "./raceSetupService";
import {HttpsError} from "firebase-functions/v2/https";

/** Canonical document reads include rejected candidates and automatic transaction retries. */
export const RACE_MATCH_DOCUMENT_READ_BUDGET = 1000;
/** Caps repeated contention independently of candidate-document retrieval. */
export const RACE_MATCH_TRANSACTION_BUDGET = 200;
/** Stops issuing new work after this elapsed lookup time; already-issued reads may finish later. */
export const RACE_MATCH_LOOKUP_MS = 15000;

/** Application read-attempt telemetry; Query Explain remains the authority for index scans/billing. */
export type RaceMatchReadMeter = {
  /** Direct and transactional document read attempts, including retries and missing documents. */ documentReadAttempts: number;
  /** Transaction callback invocations, including automatic retries. */ transactionAttempts: number;
  /** Real elapsed lookup deadline, independent of the authoritative scoring clock. */ deadlineAtMs?: number;
  /** Instrumented transaction document RPC groups, excluding direct ingress reads and candidate queries. */ documentReadBatches?: number;
  /** Reused document promises within one transaction callback, never across retries. */ documentReadCacheHits?: number;
};

/** Exhausted work budgets are retryable search failures, never an empty opponent pool. */
export function assertRaceMatchReadBudget(meter: RaceMatchReadMeter, startingTransaction = false): void {
  if (meter.documentReadAttempts >= RACE_MATCH_DOCUMENT_READ_BUDGET || startingTransaction && meter.transactionAttempts >= RACE_MATCH_TRANSACTION_BUDGET)
    throw new HttpsError("resource-exhausted", "Match search reached its storage work budget. Please retry.");
  if (meter.deadlineAtMs !== undefined && Date.now() >= meter.deadlineAtMs)
    throw new HttpsError("deadline-exceeded", "Match search exceeded its lookup time budget. Please retry.");
}

/** Measures canonical eligibility/offer reads through the same transaction interface used by their implementations. */
export function withMeteredRaceTransaction<T>(db: Firestore, meter: RaceMatchReadMeter,
  operation: (transaction: FirebaseFirestore.Transaction) => Promise<T>): Promise<T> {
  return db.runTransaction(async transaction => {
    assertRaceMatchReadBudget(meter, true);
    meter.transactionAttempts++;
    /** Issued reads must settle before a budget failure leaves this callback. */
    const reads: Promise<unknown>[] = [];
    /** One transaction snapshot owns this cache; automatic retries create a new one. */
    const cache = new Map<string, Promise<FirebaseFirestore.DocumentSnapshot>>();
    /** Reads each unique path once and preserves input ordering across grouped RPCs. */
    const readDocuments = (references: FirebaseFirestore.DocumentReference[], batch: boolean): Promise<FirebaseFirestore.DocumentSnapshot[]> => {
      /** Pending shared reads are installed before another caller can inspect the cache. */
      const missing = references.filter((reference, index) => !cache.has(reference.path) &&
        (!reference.path || references.findIndex(item => item.path === reference.path) === index));
      /** Cache reuse reduces physical work without relaxing any transaction's read set. */
      if (meter.documentReadCacheHits !== undefined) meter.documentReadCacheHits += references.length - missing.length;
      if (missing.length) {
        assertRaceMatchReadBudget(meter);
        if (meter.documentReadAttempts + missing.length > RACE_MATCH_DOCUMENT_READ_BUDGET)
          return Promise.reject(new HttpsError("resource-exhausted", "Match search reached its storage work budget. Please retry."));
        meter.documentReadAttempts += missing.length;
        if (meter.documentReadBatches !== undefined) meter.documentReadBatches++;
        /** Deferral installs all promises before even a synchronously throwing adapter runs. */
        const issued = Promise.resolve().then(async () => {
          // The budget is already reserved; the final permitted read remains valid.
          // Recheck only elapsed time at actual dispatch, after promise installation.
          if (meter.deadlineAtMs !== undefined && Date.now() >= meter.deadlineAtMs)
            throw new HttpsError("deadline-exceeded", "Match search exceeded its lookup time budget. Please retry.");
          return batch && typeof transaction.getAll === "function" ? transaction.getAll(...missing)
            : Promise.all(missing.map(reference => transaction.get(reference)));
        });
        reads.push(issued);
        for (const [index, reference] of missing.entries()) {
          /** Firestore snapshots carry their physical path; narrow mocks may use ordered results. */
          if (reference.path) cache.set(reference.path, issued.then(snapshots => snapshots.find(snapshot => snapshot.ref?.path === reference.path) ?? snapshots[index]));
        }
        if (references.every(reference => !reference.path)) return issued;
      }
      return Promise.all(references.map(reference => cache.get(reference.path)!));
    };
    /** Provides measured behavior. */
    const measured = new Proxy(transaction, {
    /** Intercepts transaction document reads for telemetry. */
    get(target, property) {
      if (property === "get") return (reference: FirebaseFirestore.DocumentReference) =>
        Promise.resolve().then(() => readDocuments([reference], false)).then(snapshots => snapshots[0]);
      if (property === "getAll") return (...references: FirebaseFirestore.DocumentReference[]) =>
        Promise.resolve().then(() => readDocuments(references, true));
      /** Provides member behavior. */
      const member = Reflect.get(target, property);
      return typeof member === "function" ? member.bind(target) : member;
    }});
    try {return await operation(measured);}
    finally {await Promise.allSettled(reads);}
  });
}
