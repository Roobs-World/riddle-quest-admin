"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishLiveRaceSignals = publishLiveRaceSignals;
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
/** Publishes only a wake-up revision atomically with authoritative match changes. */
function publishLiveRaceSignals(db, transaction, tickets, expiresAt = firestore_1.Timestamp.fromMillis(Date.now() + 7 * 86_400_000)) {
    /** One committed revision coalesces both seats without exposing match contents. */
    const revision = (0, node_crypto_1.randomUUID)();
    for (const ticketId of tickets)
        if (ticketId)
            transaction.set(db.doc(`liveRaceSignals/${ticketId}`), { revision, expiresAt });
}
//# sourceMappingURL=raceLiveSignals.js.map