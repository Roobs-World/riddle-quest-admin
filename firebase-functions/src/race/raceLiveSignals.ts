import {Timestamp} from "firebase-admin/firestore";
import {randomUUID} from "node:crypto";
import type {Firestore} from "./raceSetupService";

/** Publishes only a wake-up revision atomically with authoritative match changes. */
export function publishLiveRaceSignals(db: Firestore, transaction: FirebaseFirestore.Transaction,
  tickets: readonly (string | null)[], expiresAt: FirebaseFirestore.Timestamp = Timestamp.fromMillis(Date.now() + 7 * 86_400_000)): void {
  /** One committed revision coalesces both seats without exposing match contents. */
  const revision = randomUUID();
  for (const ticketId of tickets) if (ticketId)
    transaction.set(db.doc(`liveRaceSignals/${ticketId}`), {revision, expiresAt});
}
