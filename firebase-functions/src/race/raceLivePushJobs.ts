import {z} from "zod";
import {getMessaging} from "firebase-admin/messaging";
import {createHash} from "node:crypto";
import {Timestamp} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {runWithJestAccountOperationLease, getJestAccountDeletionRef, assertJestAccountActive} from "../jest/jestAccountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {deliverLiveRacePush, sendFacebookLiveChallengePush} from "./raceLivePushDelivery";

/** Dedicated server-only Meta notification credential. */
const facebookNotificationToken = defineSecret("FACEBOOK_NOTIFICATION_APP_ACCESS_TOKEN");
/** Resolves only the current signed Facebook identity generation. */
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
/** Browser token ownership is bound exclusively to the authenticated registered Jest account. */
const Subscription = z.object({enabled: z.boolean(), token: z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/).optional()})
  .strict().refine(input => !input.enabled || Boolean(input.token));

/** Registers explicit browser push consent or revokes it; never accepts another player's identity. */
export const setLiveRacePushSubscription = onCallWithSentry("setLiveRacePushSubscription", {
  ...browserCallableSecurityOptions, region: "europe-west1",
}, async request => {
  /** Strictly validated authenticated subscription request. */
  const input = validateCallableRequest(Subscription, request.data, "setLiveRacePushSubscription");
  /** Caller identity from verified Firebase authentication. */
  const uid = request.auth?.uid;
  if (!uid || raceProviderScope(uid) !== "jest" || request.auth?.token.jestRegistered !== true)
    throw new HttpsError("permission-denied", "Registered Jest account required.");
  await runWithJestAccountOperationLease(uid, 30, async () => {
    /** Isolated or configured server database. */
    const db = admin.firestore();
    await db.runTransaction(async tx => {
      /** Account-owned subscription or notification receipt. */
      const ref = db.doc(`users/${uid}/livePushSubscriptions/current`);
      /** Account, safety and receipt snapshots read before transaction writes. */
      const [user, deleted, current] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(getJestAccountDeletionRef(db, uid)), tx.get(ref)]);
      assertJestAccountActive(deleted);
      if (!user.exists) throw new HttpsError("not-found", "Account unavailable.");
      /** Previous browser instance ownership key. */
      const oldTokenHash = current.data()?.tokenHash;
      /** Previous browser token owner, read before writes. */
      const oldBinding = typeof oldTokenHash === "string" && /^[a-f0-9]{64}$/.test(oldTokenHash)
        ? await tx.get(db.doc(`liveRacePushTokens/${oldTokenHash}`)) : undefined;
      if (oldBinding?.data()?.uid === uid) tx.delete(oldBinding.ref);
      if (input.enabled) {
        /** Opaque browser token index key without retaining the token globally. */
        const tokenHash = createHash("sha256").update(input.token!).digest("hex");
        tx.set(ref, {token: input.token, tokenHash, enabled: true, updatedAtMs: Date.now()});
        // One browser token belongs to its latest signed-in account, preventing shared-device cross-account pushes.
        tx.set(db.doc(`liveRacePushTokens/${tokenHash}`), {uid, expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000)});
      } else tx.delete(ref);
    });
  });
  return {enabled: input.enabled};
});

/** Delivers durable challenge work after the inviter's browser has closed. Provider requests are never replayed after a claim. */
export const deliverLiveRaceChallengePush = onDocumentCreated({document: "liveRacePushOutbox/{eventId}",
  region: "europe-west1", retry: true, timeoutSeconds: 60, secrets: [facebookNotificationToken, facebookUidSecret]}, async event => {
  /** Isolated or configured server database. */
  const db = admin.firestore();
  await deliverLiveRacePush(db, event.params.eventId, async delivery =>
    runWithJestAccountOperationLease(delivery.event.recipientId, 60, async () => {
      if (raceProviderScope(delivery.event.recipientId) === "facebook") return sendFacebookLiveChallengePush(db, delivery, {
        appId: process.env.FACEBOOK_APP_ID ?? "", uidSecret: facebookUidSecret.value(), appAccessToken: facebookNotificationToken.value(),
        enabled: process.env.FACEBOOK_CHALLENGE_PUSH_ENABLED === "1",
      });
      if (process.env.JEST_CHALLENGE_PUSH_ENABLED !== "1" || !delivery.token) return "skipped";
      /** Consent rechecked immediately before contacting Firebase Messaging. */
      const subscription = await db.doc(`users/${delivery.event.recipientId}/livePushSubscriptions/current`).get();
      if (subscription.data()?.enabled !== true || subscription.data()?.token !== delivery.token) return "skipped";
      try {
        await getMessaging().send({token: delivery.token, data: {kind: "liveChallenge", challengeId: delivery.event.challengeId,
          title: delivery.title, body: delivery.body, expiresAtMs: String(delivery.event.expiresAtMs)},
        webpush: {headers: {TTL: String(Math.max(0, Math.floor((delivery.event.expiresAtMs - Date.now()) / 1000)))}}});
        return "submitted";
      } catch (failure) {
        /** Bounded Firebase error code; provider details are never logged. */
        const code = (failure as {
          /** Fixed Firebase error identifier. */
          code?: string;
        })?.code;
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code ?? "")) {
          await db.runTransaction(async tx => {
            /** Account-owned subscription or notification receipt. */
            const ref = db.doc(`users/${delivery.event.recipientId}/livePushSubscriptions/current`), current = await tx.get(ref);
            if (current.data()?.token === delivery.token) tx.delete(ref);
          });
          return "skipped";
        }
        return "unconfirmed";
      }
    }));
});
