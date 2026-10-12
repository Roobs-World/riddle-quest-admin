"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookContextRetentionScheduler = void 0;
exports.facebookContextRetentionHandler = facebookContextRetentionHandler;
const firebase_functions_1 = require("firebase-functions");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const facebookContextRetention_1 = require("./facebookContextRetention");
/** Runs bounded Facebook-only cleanup without exposing provider/storage diagnostics. */
async function facebookContextRetentionHandler() {
    try {
        /** At most twenty boards and fifty score entries per board are eligible per invocation. */
        const result = await (0, facebookContextRetention_1.purgeExpiredFacebookContextPage)(firebaseAdmin_1.admin.firestore(), Date.now(), true);
        firebase_functions_1.logger.info("Facebook context retention page finished.", result);
        if (result.invalid > 0)
            throw new Error("facebook-context-retention-page-incomplete");
    }
    catch {
        throw new Error("Facebook context retention failed; inspect aggregate page evidence.");
    }
}
/** Hourly cleanup is idempotent under repeated/overlapping scheduler delivery and context rollover. */
exports.facebookContextRetentionScheduler = (0, sentryHandlers_1.onScheduleWithSentry)("facebookContextRetentionScheduler", { schedule: "17 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
    memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2 }, facebookContextRetentionHandler);
//# sourceMappingURL=facebookContextRetentionScheduler.js.map