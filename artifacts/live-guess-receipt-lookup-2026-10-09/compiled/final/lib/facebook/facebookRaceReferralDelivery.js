"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsFacebookRaceReferral = void 0;
exports.finishFacebookRaceReferralDelivery = finishFacebookRaceReferralDelivery;
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookSecurity_1 = require("./facebookSecurity");
const facebookReferrals_1 = require("./facebookReferrals");
/** Only canonical Facebook wins participate; other providers retain their existing delivery path. */
const needsFacebookRaceReferral = (userId, won) => won && (0, facebookSecurity_1.isFacebookFirebaseUid)(userId) && (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("referrals");
exports.needsFacebookRaceReferral = needsFacebookRaceReferral;
/**
 * Acknowledges an existing race outbox only after the idempotent referral grant.
 * Projection work commits first, leaving delivered=false for existing trigger/queue retries.
 * A crash between the grant and this acknowledgement safely replays the settlement receipt.
 */
async function finishFacebookRaceReferralDelivery(db, eventRef, userId, nowMs) {
    await (0, facebookReferrals_1.settleFacebookReferralAfterAuthoritativeWin)(userId, nowMs, db);
    await db.runTransaction(async (transaction) => {
        /** Concurrent successful, suppressed or quarantined delivery wins. */
        const current = await transaction.get(eventRef);
        if (!current.exists || current.data()?.delivered === true)
            return;
        transaction.update(eventRef, { delivered: true, deliveryState: "delivered", deliveredAtMs: nowMs });
    });
}
//# sourceMappingURL=facebookRaceReferralDelivery.js.map