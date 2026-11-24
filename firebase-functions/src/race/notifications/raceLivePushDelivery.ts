import type {Firestore} from "firebase-admin/firestore";
import type {LiveChallengePushEvent} from "../invitations/raceLiveChallengeNotifications";

/** Content supplied by a trusted manager dispatcher to a native transport. */
export type LiveChallengePushDelivery = {
  event: LiveChallengePushEvent;
  title: string;
  body: string;
};

/** Provider acceptance does not prove delivery to the player. */
export type LiveChallengePushResult = "submitted" | "unconfirmed" | "skipped";

/** Legacy invitation events have no manager-authored content and must never send. */
export async function retireLegacyLiveRacePush(db: Firestore, eventId: string, nowMs = Date.now()): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(eventId)) return;
  const ref = db.doc(`liveRacePushOutbox/${eventId}`);
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.status !== "queued") return;
    tx.update(ref, {status: "skipped", reason: "manager-content-required", finishedAtMs: nowMs});
  });
}
