import {HttpsError} from "firebase-functions/v2/https";
import type {RetireLiveRaceJoin, RetireLiveRaceJoinResponse} from "../../../../src/races/contracts/index.js";
import {admin} from "../../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {raceProviderScope} from "../access/raceProviderScope";
import {requestDocumentId, type Firestore} from "../raceSetupService";
import {liveJoinIntentRef, type LiveJoinIntent} from "../invitations/raceLiveJoinIntent";
import {updateLiveRaceForUser} from "./raceLiveService";

/** Retirement uses the same private SDK database and authoritative clock seams. */
type Options = {
  /** Dedicated emulator for transaction races. */ db?: Firestore;
  /** Test-only authoritative time. */ nowMs?: number;
  /** Rollout authorization is evaluated on every write transaction attempt. */ authorize?: () => Promise<void>;
};
/** Durably retires one account-owned intent before conditionally leaving its original ticket. */
export async function retireLiveRaceJoinForUser(userId: string, input: RetireLiveRaceJoin, options: Options = {}): Promise<RetireLiveRaceJoinResponse> {
  if (input.expectedOwnerId && input.expectedOwnerId !== userId)
    throw new HttpsError("permission-denied", "Live race account changed.");
  if (!raceProviderScope(userId)) throw new HttpsError("permission-denied", "Live races require a provider identity.");
  /** All facts remain in the caller's recursively deleted account subtree. */
  const db = options.db ?? admin.firestore(), ref = liveJoinIntentRef(db, userId, input.requestId);
  /** The durable marker prevents late or retried original joins from creating another seat. */
  const ticketId = await db.runTransaction(async transaction => {
    /** Authenticated account and current intent are read together before any write. */
    const [snapshot, owner, deletion] = await Promise.all([transaction.get(ref), transaction.getAll(db.doc(`users/${userId}`), {fieldMask: ["username"]}).then(([profile]) => profile),
      transaction.get(getJestAccountDeletionRef(db, userId)), options.authorize?.()]);
    assertJestAccountActive(deletion);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    /** Only a server-published receipt may select a ticket for background retirement. */
    const intent = snapshot.data() as LiveJoinIntent | undefined;
    if (!intent?.retired) transaction.set(ref, {...intent, retired: true,
      expiresAt: snapshot.data()?.expiresAt ?? admin.firestore.Timestamp.fromMillis((options.nowMs ?? Date.now()) + 7 * 86_400_000)});
    return intent?.ticketId;
  });
  if (!ticketId) return {status: "retired"};
  try {
    // The existing leave transaction rechecks both owner and claim after any concurrent newer join.
    await updateLiveRaceForUser(userId, {ticketId, action: "leave", requestId: `retire-${requestDocumentId(userId, input.requestId)}`},
      {...options, expectedJoinId: requestDocumentId(userId, input.requestId)});
    return {status: "retired"};
  } catch (failure) {
    if (failure instanceof HttpsError && failure.code === "permission-denied" &&
      failure.details && typeof failure.details === "object" && "reason" in failure.details &&
      failure.details.reason === "live-join-superseded") return {status: "superseded"};
    throw failure;
  }
}
