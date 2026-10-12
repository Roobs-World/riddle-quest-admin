"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsRedditLiveRaceReferral = exports.redditLiveRaceReferralEventId = void 0;
exports.validateRedditLiveRaceReferralSource = validateRedditLiveRaceReferralSource;
exports.finishRedditLiveRaceReferralDelivery = finishRedditLiveRaceReferralDelivery;
const raceLiveReferralDelivery_1 = require("../race/raceLiveReferralDelivery");
const redditSecurity_1 = require("./redditSecurity");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
const redditReferrals_1 = require("./redditReferrals");
/** Reddit cannot collide with either legacy request IDs or Facebook's live hash domain. */
const redditLiveRaceReferralEventId = (userId, ticketId) => (0, raceLiveReferralDelivery_1.liveRaceReferralEventId)("reddit", userId, ticketId);
exports.redditLiveRaceReferralEventId = redditLiveRaceReferralEventId;
/** Provider identity and emergency-off state are rechecked during delivery. */
const needsRedditLiveRaceReferral = (userId) => (0, redditSecurity_1.isRedditFirebaseUid)(userId) && (0, redditFeatureFlags_1.isRedditFeatureEnabled)("referrals");
exports.needsRedditLiveRaceReferral = needsRedditLiveRaceReferral;
/** Reddit accepts only its own source discriminator and immutable private winner binding. */
function validateRedditLiveRaceReferralSource(transaction, db, receipt, nowMs) {
    return (0, raceLiveReferralDelivery_1.validateLiveRaceReferralSource)(transaction, db, receipt, nowMs, "reddit");
}
/** Grant-before-ack uses the existing idempotent ledger and durable trigger/queue retries. */
async function finishRedditLiveRaceReferralDelivery(db, eventRef, userId, nowMs) {
    await (0, redditReferrals_1.settleRedditReferralAfterAuthoritativeWin)(userId, nowMs, db);
    await db.runTransaction(async (transaction) => {
        /** Provides current behavior. */
        const current = await transaction.get(eventRef);
        if (!current.exists || current.data()?.delivered === true)
            return;
        transaction.update(eventRef, { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
    });
}
//# sourceMappingURL=redditLiveRaceReferralDelivery.js.map