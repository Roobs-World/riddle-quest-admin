"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditProfileRetentionScheduler = void 0;
exports.redditProfileRetentionHandler = redditProfileRetentionHandler;
const firebase_functions_1 = require("firebase-functions");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const redditProfileRetention_1 = require("./redditProfileRetention");
/** Clears one bounded Reddit cache page while containing all private storage diagnostics. */
async function redditProfileRetentionHandler() {
    try {
        /** Profile cleanup remains necessary independently of optional feature switches. */
        const result = await (0, redditProfileRetention_1.purgeExpiredRedditProfilePage)(firebaseAdmin_1.admin.firestore(), Date.now(), true);
        firebase_functions_1.logger.info("Reddit profile retention page finished.", result);
        if (result.invalid > 0)
            throw new Error("reddit-profile-retention-page-incomplete");
    }
    catch {
        throw new Error("Reddit profile retention failed; inspect aggregate page evidence.");
    }
}
/** Overlapping/retried invocations clear fields idempotently without expiring permanent identities. */
exports.redditProfileRetentionScheduler = (0, sentryHandlers_1.onScheduleWithSentry)("redditProfileRetentionScheduler", { schedule: "29 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
    memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2 }, redditProfileRetentionHandler);
//# sourceMappingURL=redditProfileRetentionScheduler.js.map