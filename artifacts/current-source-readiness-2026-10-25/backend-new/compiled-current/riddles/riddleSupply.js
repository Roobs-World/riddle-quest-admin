"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerClassicRiddleGenerationIfNeeded = triggerClassicRiddleGenerationIfNeeded;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const functions = __importStar(require("firebase-functions"));
const constants_1 = require("../shared/constants");
const sentry_1 = require("../shared/sentry");
/** Defines the riddle supply requests collection value. */
const RIDDLE_SUPPLY_REQUESTS_COLLECTION = "classicSupplyJobs";
/** Indicates whether is already exists error. */
function isAlreadyExistsError(error) {
    if (!error || typeof error !== "object")
        return false;
    /** Provides code behavior. */
    const code = error.code;
    return code === 6 || code === "already-exists" || code === "6";
}
/** Durably requests localized supply without running the model in a player request. */
async function triggerClassicRiddleGenerationIfNeeded(userId, currentClassicIndex, locale) {
    try {
        /** Provides collection behavior. */
        const collection = `localizedRiddles/${locale}/riddles`;
        /** Highest-index discovery excludes unused text, answers and provenance from the backend payload. */
        const snapshot = await firebaseAdmin_1.admin
            .firestore()
            .collection(collection)
            .where("classicIndex", ">=", 0)
            .orderBy("classicIndex", "desc")
            .limit(1)
            .select("classicIndex")
            .get();
        /** Provides highest classic index behavior. */
        const highestClassicIndex = snapshot.empty ? -1 : Number(snapshot.docs[0]?.data().classicIndex ?? -1);
        /** Provides remaining behavior. */
        const remaining = highestClassicIndex - currentClassicIndex;
        functions.logger.info(`User ${userId} currentClassicIndex: ${currentClassicIndex}, highestClassicIndex: ${highestClassicIndex}, remainingClassicRiddles: ${remaining}`);
        if (remaining > constants_1.RIDDLE_GENERATION_THRESHOLD)
            return;
        /** Requests ref. */
        const requestRef = firebaseAdmin_1.admin
            .firestore()
            .collection(RIDDLE_SUPPLY_REQUESTS_COLLECTION)
            .doc(`${locale}_${highestClassicIndex}`);
        try {
            await requestRef.create({
                locale,
                highestClassicIndex,
                requestedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                nextAttemptAtMs: 0,
            });
        }
        catch (error) {
            if (isAlreadyExistsError(error)) {
                // Player activity can restart a request after Eventarc's retry window has expired.
                await firebaseAdmin_1.admin.firestore().runTransaction(async (transaction) => {
                    /** Existing deterministic request inspected before reactivation. */
                    const snapshot = await transaction.get(requestRef);
                    /** Persisted completion and retry state owned by the worker. */
                    const current = snapshot.data();
                    /** Server clock shared by the retry and outage-age checks. */
                    const nowMs = Date.now();
                    if (!snapshot.exists || current?.completed === true || current?.nextAttemptAtMs > nowMs)
                        return;
                    /** Most recent activation determines the minimum recovery interval. */
                    const requestedAtMs = current?.requeuedAtMs ?? current?.requestedAt?.toMillis?.();
                    if (!Number.isFinite(requestedAtMs) || nowMs - requestedAtMs < 24 * 60 * 60 * 1000)
                        return;
                    transaction.update(requestRef, { requeuedAtMs: nowMs, nextAttemptAtMs: nowMs });
                });
                functions.logger.info(`Riddle replenishment is already claimed for ${locale} at ${highestClassicIndex}.`);
                return;
            }
            throw error;
        }
        functions.logger.info("Queued Classic replenishment without delaying gameplay.", { locale, highestClassicIndex });
    }
    catch (error) {
        functions.logger.error("Error checking classic riddle count:", error);
        (0, sentry_1.captureException)(error);
    }
}
//# sourceMappingURL=riddleSupply.js.map