"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverLiveRaceChallengePush = exports.setLiveRacePushSubscription = void 0;
const zod_1 = require("zod");
const messaging_1 = require("firebase-admin/messaging");
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("./raceEligibility");
const raceLivePushDelivery_1 = require("./raceLivePushDelivery");
/** Dedicated server-only Meta notification credential. */
const facebookNotificationToken = (0, params_1.defineSecret)("FACEBOOK_NOTIFICATION_APP_ACCESS_TOKEN");
/** Resolves only the current signed Facebook identity generation. */
const facebookUidSecret = (0, params_1.defineSecret)("FACEBOOK_UID_SECRET");
/** Browser token ownership is bound exclusively to the authenticated registered Jest account. */
const Subscription = zod_1.z.object({ enabled: zod_1.z.boolean(), token: zod_1.z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/).optional() })
    .strict().refine(input => !input.enabled || Boolean(input.token));
/** Registers explicit browser push consent or revokes it; never accepts another player's identity. */
exports.setLiveRacePushSubscription = (0, sentryHandlers_1.onCallWithSentry)("setLiveRacePushSubscription", {
    ...callableSecurity_1.browserCallableSecurityOptions, region: "europe-west1",
}, async (request) => {
    /** Strictly validated authenticated subscription request. */
    const input = (0, callableValidation_1.validateCallableRequest)(Subscription, request.data, "setLiveRacePushSubscription");
    /** Caller identity from verified Firebase authentication. */
    const uid = request.auth?.uid;
    if (!uid || (0, raceEligibility_1.raceProviderScope)(uid) !== "jest" || request.auth?.token.jestRegistered !== true)
        throw new https_1.HttpsError("permission-denied", "Registered Jest account required.");
    await (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(uid, 30, async () => {
        /** Isolated or configured server database. */
        const db = firebaseAdmin_1.admin.firestore();
        await db.runTransaction(async (tx) => {
            /** Account-owned subscription or notification receipt. */
            const ref = db.doc(`users/${uid}/livePushSubscriptions/current`);
            /** Account, safety and receipt snapshots read before transaction writes. */
            const [user, deleted, current] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, uid)), tx.get(ref)]);
            (0, jestAccountDeletion_1.assertJestAccountActive)(deleted);
            if (!user.exists)
                throw new https_1.HttpsError("not-found", "Account unavailable.");
            /** Previous browser instance ownership key. */
            const oldTokenHash = current.data()?.tokenHash;
            /** Previous browser token owner, read before writes. */
            const oldBinding = typeof oldTokenHash === "string" && /^[a-f0-9]{64}$/.test(oldTokenHash)
                ? await tx.get(db.doc(`liveRacePushTokens/${oldTokenHash}`)) : undefined;
            if (oldBinding?.data()?.uid === uid)
                tx.delete(oldBinding.ref);
            if (input.enabled) {
                /** Opaque browser token index key without retaining the token globally. */
                const tokenHash = (0, node_crypto_1.createHash)("sha256").update(input.token).digest("hex");
                tx.set(ref, { token: input.token, tokenHash, enabled: true, updatedAtMs: Date.now() });
                // One browser token belongs to its latest signed-in account, preventing shared-device cross-account pushes.
                tx.set(db.doc(`liveRacePushTokens/${tokenHash}`), { uid, expiresAt: firestore_1.Timestamp.fromMillis(Date.now() + 30 * 86_400_000) });
            }
            else
                tx.delete(ref);
        });
    });
    return { enabled: input.enabled };
});
/** Delivers durable challenge work after the inviter's browser has closed. Provider requests are never replayed after a claim. */
exports.deliverLiveRaceChallengePush = (0, firestore_2.onDocumentCreated)({ document: "liveRacePushOutbox/{eventId}",
    region: "europe-west1", retry: true, timeoutSeconds: 60, secrets: [facebookNotificationToken, facebookUidSecret] }, async (event) => {
    /** Isolated or configured server database. */
    const db = firebaseAdmin_1.admin.firestore();
    await (0, raceLivePushDelivery_1.deliverLiveRacePush)(db, event.params.eventId, async (delivery) => (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(delivery.event.recipientId, 60, async () => {
        if ((0, raceEligibility_1.raceProviderScope)(delivery.event.recipientId) === "facebook")
            return (0, raceLivePushDelivery_1.sendFacebookLiveChallengePush)(db, delivery, {
                appId: process.env.FACEBOOK_APP_ID ?? "", uidSecret: facebookUidSecret.value(), appAccessToken: facebookNotificationToken.value(),
                enabled: process.env.FACEBOOK_CHALLENGE_PUSH_ENABLED === "1",
            });
        if (process.env.JEST_CHALLENGE_PUSH_ENABLED !== "1" || !delivery.token)
            return "skipped";
        /** Consent rechecked immediately before contacting Firebase Messaging. */
        const subscription = await db.doc(`users/${delivery.event.recipientId}/livePushSubscriptions/current`).get();
        if (subscription.data()?.enabled !== true || subscription.data()?.token !== delivery.token)
            return "skipped";
        try {
            await (0, messaging_1.getMessaging)().send({ token: delivery.token, data: { kind: "liveChallenge", challengeId: delivery.event.challengeId,
                    title: delivery.title, body: delivery.body, expiresAtMs: String(delivery.event.expiresAtMs) },
                webpush: { headers: { TTL: String(Math.max(0, Math.floor((delivery.event.expiresAtMs - Date.now()) / 1000))) } } });
            return "submitted";
        }
        catch (failure) {
            /** Bounded Firebase error code; provider details are never logged. */
            const code = failure?.code;
            if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code ?? "")) {
                await db.runTransaction(async (tx) => {
                    /** Account-owned subscription or notification receipt. */
                    const ref = db.doc(`users/${delivery.event.recipientId}/livePushSubscriptions/current`), current = await tx.get(ref);
                    if (current.data()?.token === delivery.token)
                        tx.delete(ref);
                });
                return "skipped";
            }
            return "unconfirmed";
        }
    }));
});
//# sourceMappingURL=raceLivePushJobs.js.map