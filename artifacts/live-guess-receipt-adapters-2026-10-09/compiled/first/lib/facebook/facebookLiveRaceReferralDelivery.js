"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookLiveRaceReferralEventId = void 0;
exports.validateFacebookLiveRaceReferralSource = validateFacebookLiveRaceReferralSource;
const raceLiveReferralDelivery_1 = require("../race/raceLiveReferralDelivery");
/** Facebook keeps its existing separate hash domain and durable receipts. */
const facebookLiveRaceReferralEventId = (userId, ticketId) => (0, raceLiveReferralDelivery_1.liveRaceReferralEventId)("facebook", userId, ticketId);
exports.facebookLiveRaceReferralEventId = facebookLiveRaceReferralEventId;
/** Facebook authority never accepts another provider's source or private binding. */
function validateFacebookLiveRaceReferralSource(transaction, db, receipt, nowMs) {
    return (0, raceLiveReferralDelivery_1.validateLiveRaceReferralSource)(transaction, db, receipt, nowMs, "facebook");
}
//# sourceMappingURL=facebookLiveRaceReferralDelivery.js.map