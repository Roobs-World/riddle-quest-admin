import {Timestamp} from "firebase-admin/firestore";
import {HttpsError, type CallableResponse} from "firebase-functions/v2/https";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../shared/accountDeletion";
import type {Firestore} from "../raceSetupService";

/** Maximum stream admission lifetime before credentials and authority are checked again. */
const STREAM_LIFETIME_MS = 45_000;
/** Strict shape of one random connection lease and its safe expiry timestamp. */
const StreamLeaseSchema = z.object({leaseId: z.string().uuid(), expiresAtMs: z.number().int().positive().safe()}).strict();
/** Strict account admission ledger permitting at most two concurrent leases. */
const StreamAdmissionsSchema = z.object({leases: z.array(StreamLeaseSchema).max(2)}).strict();

/** Streams only owned revisions; admission changes no scores, receipts or rewards. */
export async function streamLiveRaceChanges(db: Firestore, userId: string, ticketId: string,
  response: CallableResponse<{
    /** Notification carries no gameplay or account contents. */
    revision: string | null;
  }>, lifetimeMs = STREAM_LIFETIME_MS): Promise<void> {
  if (response.signal.aborted) return;
  /** Private per-account document that serializes stream admission and cleanup. */
  const admissionRef = db.doc(`users/${userId}/liveRaceStreamAdmissions/current`);
  /** Random lease identity that isolates this connection from replacement cleanup. */
  const leaseId = randomUUID();
  /** Positive whole-millisecond lifetime capped at the production stream limit. */
  const boundedLifetimeMs = Number.isFinite(lifetimeMs) && lifetimeMs > 0 ? Math.min(Math.max(1, Math.floor(lifetimeMs)), STREAM_LIFETIME_MS) : STREAM_LIFETIME_MS;
  /** Lease committed with fresh account, deletion and ticket ownership checks. */
  const lease = await db.runTransaction(async transaction => {
    /** Canonical ticket, account, deletion guard and current stream admission ledger. */
    const [ticket, owner, deletion, admissions] = await Promise.all([transaction.get(db.doc(`liveRaceTickets/${ticketId}`)),
      transaction.get(db.doc(`users/${userId}`)), transaction.get(getJestAccountDeletionRef(db, userId)), transaction.get(admissionRef)]);
    assertJestAccountActive(deletion);
    if (!owner.exists || !ticket.exists || ticket.data()?.userId !== userId)
      throw new HttpsError("permission-denied", "Live observation unavailable.");
    /** Server clock and the retained ticket deadline that bound admission. */
    const nowMs = Date.now(), expiry = ticket.data()?.expiresAt;
    if (!(expiry instanceof Timestamp) || expiry.toMillis() <= nowMs) throw new HttpsError("not-found", "Live observation expired.");
    /** Validated existing lease ledger, or an empty ledger for the first stream. */
    const parsed = StreamAdmissionsSchema.safeParse(admissions.exists ? admissions.data() : {leases: []});
    if (!parsed.success) throw new HttpsError("unavailable", "Live observation unavailable.");
    /** Unexpired connection leases counted against the account's two-stream limit. */
    const active = parsed.data.leases.filter(current => current.expiresAtMs > nowMs);
    if (active.length >= 2) throw new HttpsError("resource-exhausted", "Too many live observations.");
    /** New connection lease capped by both stream lifetime and ticket retention. */
    const admitted = {leaseId, expiresAtMs: Math.min(nowMs + boundedLifetimeMs, expiry.toMillis())};
    transaction.set(admissionRef, {leases: [...active, admitted]});
    return admitted;
  });
  try {
    if (response.signal.aborted || Date.now() >= lease.expiresAtMs) return;
    await new Promise<void>((resolve, reject) => {
      /** Cleanups release listeners on expiry, connection loss, deletion and send failures. */
      const subscriptions: (() => void)[] = [];
      /** Last observed revision and ordered writes belong to this bounded connection. */
      let revision: string | null = null, expiresAtMs = 0, stopped = false, pending = Promise.resolve();
      /** Connection timers cleared together when the stream finishes. */
      const timers: {
        /** Timer that closes the connection at its original admission deadline. */
        timeout?: ReturnType<typeof setTimeout>;
        /** Interval that detects transport failure even when revisions do not change. */
        heartbeat?: ReturnType<typeof setInterval>;
      } = {};
      /** Whether this stream remains open, connected and within its committed lease. */
      const active = () => !stopped && !response.signal.aborted && Date.now() < lease.expiresAtMs;
      /** Releasing observers never waits for a game mutation or account deletion. */
      const finish = (error?: unknown) => {
        if (stopped) return;
        stopped = true; clearTimeout(timers.timeout); clearInterval(timers.heartbeat);
        response.signal.removeEventListener("abort", abort);
        subscriptions.forEach(stop => stop());
        if (error) reject(error); else resolve();
      };
      /** Network disconnects immediately release all database listeners. */
      const abort = () => finish();
      /** Serializes chunks so an earlier send cannot arrive after a newer revision. */
      const send = () => {
        if (!active()) {finish(); return;}
        /** Capture this revision before subsequent snapshots advance it. */
        const chunk = {revision, expiresAtMs};
        pending = pending.then(async () => {
          if (!active()) {finish(); return;}
          if (!await response.sendChunk({revision: chunk.expiresAtMs > Date.now() ? chunk.revision : null}) || !active()) finish();
        })
          .catch(finish);
      };
      response.signal.addEventListener("abort", abort, {once: true});
      if (!active()) {finish(); return;}
      /** Setup time consumes the original admission lease; attaching cannot extend it. */
      timers.timeout = setTimeout(() => finish(), Math.max(0, lease.expiresAtMs - Date.now()));
      /** Heartbeats let the client detect an apparently open but stalled connection. */
      timers.heartbeat = setInterval(send, 10_000);
      /** Attaches a listener only while active and disposes it if setup closes the stream. */
      const subscribe = (attach: () => () => void) => {
        if (!active()) {finish(); return;}
        /** Listener cleanup retained only while its connection remains active. */
        const stop = attach();
        if (stopped) stop(); else subscriptions.push(stop);
      };
      try {
        subscribe(() => db.doc(`users/${userId}`).onSnapshot(snapshot => {if (!snapshot.exists) finish();}, finish));
        subscribe(() => getJestAccountDeletionRef(db, userId).onSnapshot(snapshot => {if (snapshot.exists) finish();}, finish));
        subscribe(() => db.doc(`liveRaceSignals/${ticketId}`).onSnapshot(snapshot => {
          if (!active()) {finish(); return;}
          /** Match notifications are private and expire with their owned seat. */
          const next = snapshot.data()?.revision, expiry = snapshot.data()?.expiresAt;
          expiresAtMs = expiry instanceof Timestamp ? expiry.toMillis() : 0;
          revision = typeof next === "string" && expiresAtMs > Date.now() ? next : null;
          send();
        }, finish));
        if (response.signal.aborted) finish();
      } catch (error) {finish(error);}
    });
  } finally {
    /** An expired or failed process releases itself without deleting a replacement lease. */
    await db.runTransaction(async transaction => {
      /** Latest admission ledger read before removing this connection's lease. */
      const current = await transaction.get(admissionRef);
      if (!current.exists) return;
      /** Validated cleanup ledger that prevents malformed state from deleting other leases. */
      const parsed = StreamAdmissionsSchema.safeParse(current.data());
      if (!parsed.success || !parsed.data.leases.some(item => item.leaseId === leaseId)) return;
      /** Other connections' leases preserved when this connection releases admission. */
      const leases = parsed.data.leases.filter(item => item.leaseId !== leaseId);
      if (leases.length) transaction.update(admissionRef, {leases}); else transaction.delete(admissionRef);
    }).catch(() => undefined);
  }
}
