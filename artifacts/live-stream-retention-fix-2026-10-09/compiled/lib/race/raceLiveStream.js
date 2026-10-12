"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamLiveRaceChanges = streamLiveRaceChanges;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
/** Streams only an owned revision; this read-only path never changes scores, receipts or rewards. */
async function streamLiveRaceChanges(db, userId, ticketId, response, lifetimeMs = 45_000) {
    await db.runTransaction(async (transaction) => {
        /** Ownership and account lifetime are validated together before subscribing. */
        const [ticket, owner, deletion] = await Promise.all([transaction.get(db.doc(`liveRaceTickets/${ticketId}`)),
            transaction.get(db.doc(`users/${userId}`)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId))]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!owner.exists || !ticket.exists || ticket.data()?.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "Live observation unavailable.");
        /** Only a real retained timestamp can admit this private subscription. */
        const expiry = ticket.data().expiresAt;
        if (!(expiry instanceof firestore_1.Timestamp) || expiry.toMillis() <= Date.now())
            throw new https_1.HttpsError("not-found", "Live observation expired.");
    });
    if (response.signal.aborted)
        return;
    await new Promise((resolve, reject) => {
        /** Cleanups release listeners on expiry, connection loss, deletion and send failures. */
        const subscriptions = [];
        /** Last observed revision and ordered writes belong to this bounded connection. */
        let revision = null, stopped = false, pending = Promise.resolve();
        /** Releasing observers never waits for a game mutation or account deletion. */
        const finish = (error) => {
            if (stopped)
                return;
            stopped = true;
            clearTimeout(timeout);
            clearInterval(heartbeat);
            response.signal.removeEventListener("abort", abort);
            subscriptions.forEach(stop => stop());
            if (error)
                reject(error);
            else
                resolve();
        };
        /** Network disconnects immediately release all database listeners. */
        const abort = () => finish();
        /** Serializes chunks so an earlier send cannot arrive after a newer revision. */
        const send = () => {
            /** Capture this revision before subsequent snapshots advance it. */
            const chunk = { revision };
            pending = pending.then(async () => { if (!stopped && !await response.sendChunk(chunk))
                finish(); })
                .catch(finish);
        };
        response.signal.addEventListener("abort", abort, { once: true });
        /** Renew before the callable runtime deadline to refresh account credentials. */
        const timeout = setTimeout(() => finish(), lifetimeMs);
        /** Heartbeats let the client detect an apparently open but stalled connection. */
        const heartbeat = setInterval(send, 10_000);
        try {
            subscriptions.push(db.doc(`users/${userId}`).onSnapshot(snapshot => { if (!snapshot.exists)
                finish(); }, finish));
            subscriptions.push((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId).onSnapshot(snapshot => { if (snapshot.exists)
                finish(); }, finish));
            subscriptions.push(db.doc(`liveRaceSignals/${ticketId}`).onSnapshot(snapshot => {
                if (stopped)
                    return;
                /** Match notifications are private and expire with their owned seat. */
                const next = snapshot.data()?.revision, expiry = snapshot.data()?.expiresAt;
                revision = typeof next === "string" && expiry instanceof firestore_1.Timestamp && expiry.toMillis() > Date.now() ? next : null;
                send();
            }, finish));
            if (response.signal.aborted)
                finish();
        }
        catch (error) {
            finish(error);
        }
    });
}
//# sourceMappingURL=raceLiveStream.js.map