import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {z} from "zod";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {isJestAccountDeletedError, runWithJestAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {androidReferralHash} from "./androidReferralIdentity";
import {settleAndroidReferralAfterPlay} from "./androidReferrals";

/** Stable source identity prevents match retries from enqueueing a second completion. */
export const androidReferralLiveEventId = (uid: string, ticketId: string): string =>
  androidReferralHash("live-event", `${uid}\0${ticketId}`);
/** Server-only completion work contains no client-supplied reward or proof. */
const Event = z.looseObject({
  uid: z.string().regex(/^[A-Za-z0-9]{28}$/),
  matchId: z.string().regex(/^[a-f0-9]{64}$/),
  ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  delivered: z.boolean().optional(),
});
/** Grant-before-ack delivery retries only against the same canonical terminal match. */
export const deliverAndroidReferralPlay = onDocumentCreated(
  {document: "androidReferralPlayOutbox/{eventId}", region: "europe-west1", retry: true},
  async (event) => {
    /** Private Firestore reference used by this authority or replay scenario. */
    const ref = event.data?.ref,
      data = Event.safeParse(event.data?.data());
    if (
      !ref ||
      !data.success ||
      data.data.delivered ||
      event.params.eventId !== androidReferralLiveEventId(data.data.uid, data.data.ticketId)
    )
      return;
    try {
      await runWithJestAccountOperationLease(data.data.uid, 60, () =>
        settleAndroidReferralAfterPlay(admin.firestore(), data.data.uid, {
          kind: "live",
          matchId: data.data.matchId,
          ticketId: data.data.ticketId,
        }),
      );
    } catch (error) {
      if (!isJestAccountDeletedError(error)) throw error;
    }
    await admin.firestore().runTransaction(async (tx) => {
      /** Current account-owned snapshot or effect lifetime checked before applying work. */
      const current = await tx.get(ref);
      if (current.exists && current.data()?.delivered !== true) tx.update(ref, {delivered: true});
    });
  },
);
