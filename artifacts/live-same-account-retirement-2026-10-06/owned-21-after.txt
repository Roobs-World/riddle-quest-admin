import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import type {JoinLiveRace} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {requestDocumentId, type Firestore} from "./raceSetupService";

/** Account-owned join facts are removed by existing recursive account deletion and bounded by TTL. */
export type LiveJoinIntent = {
  /** Exact content, context and invitation selection accepted for this stable join identity. */ binding?: string;
  /** One original owned server ticket; retries never follow a newer active pointer. */ ticketId?: string;
  /** Retirement wins against a join that has not yet committed. */ retired?: boolean;
};
/** Private account subcollection stores no answers, profiles or rival identities. */
export function liveJoinIntentRef(db: Firestore, userId: string, requestId: string) {
  return db.doc(`users/${userId}/liveRaceJoinIntents/${requestDocumentId(userId, requestId)}`);
}
/** Reads current intent facts on every transaction attempt; legacy joins add no reads. */
export async function readLiveJoinIntent(db: Firestore, transaction: FirebaseFirestore.Transaction, userId: string, input: JoinLiveRace) {
  if (!input.retirementAware) return undefined;
  /** Stable account-owned reference also serializes retirement arriving before join publication. */
  const ref = liveJoinIntentRef(db, userId, input.requestId);
  /** A first accepted command binds all selectors, including the target-owned context. */
  const binding = createHash("sha256").update(JSON.stringify([input.locale, input.categoryId, Boolean(input.createChallenge),
    input.challengeId ?? null, input.rematchOfTicketId ?? null, input.facebookContextId ?? null])).digest("hex");
  /** Fresh SDK snapshot is never cached across Firestore retries. */
  const record = (await transaction.get(ref)).data() as LiveJoinIntent | undefined;
  if (record?.retired) throw new HttpsError("failed-precondition", "This live join was retired.");
  if (record?.binding && record.binding !== binding) throw new HttpsError("invalid-argument", "Live join id reused.");
  return {ref, binding, record, id: requestDocumentId(userId, input.requestId)};
}
/** Publishes the first accepted join and seat claim in the same transaction; repeated joins are observations. */
export function claimLiveJoinIntent(transaction: FirebaseFirestore.Transaction,
  intent: Awaited<ReturnType<typeof readLiveJoinIntent>>, ticket: FirebaseFirestore.DocumentReference, nowMs: number) {
  if (!intent || intent.record?.ticketId) return;
  transaction.set(intent.ref, {binding: intent.binding, ticketId: ticket.id, retired: false,
    expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000)});
  transaction.update(ticket, {activeJoinId: intent.id});
}
