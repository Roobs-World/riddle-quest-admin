"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashRaceCohortUser = void 0;
exports.evaluateRaceRollout = evaluateRaceRollout;
exports.getRaceAccessForUser = getRaceAccessForUser;
exports.assertRaceAccess = assertRaceAccess;
exports.recordRaceAnalyticsForUser = recordRaceAnalyticsForUser;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const node_crypto_1 = require("node:crypto");
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const redditSecurity_1 = require("../reddit/redditSecurity");
/** Validates the race rollout config data shape. */
const RaceRolloutConfigSchema = zod_1.z
    .object({
    enabled: zod_1.z.boolean().default(false),
    percentage: zod_1.z.number().min(0).max(100).default(0),
    allowlistHashes: zod_1.z
        .array(zod_1.z.string().regex(/^[a-f0-9]{64}$/))
        .max(500)
        .default([]),
})
    .strict();
/** Defines the default config value. */
const DEFAULT_CONFIG = { enabled: false, percentage: 0, allowlistHashes: [] };
/** Defines the analytics retention ms value. */
const ANALYTICS_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
/** Hashes a player identifier into the stable, non-reversible rollout key. */
const hashRaceCohortUser = (userId) => (0, node_crypto_1.createHash)("sha256").update(`riddle-quest-race-cohort-v1:${userId}`).digest("hex");
exports.hashRaceCohortUser = hashRaceCohortUser;
/** Evaluates rollout configuration for a stable player cohort. */
function evaluateRaceRollout(configInput, userId, locale = "en") {
    /** Provides config behavior. */
    const config = RaceRolloutConfigSchema.catch(DEFAULT_CONFIG).parse(configInput);
    if (!config.enabled)
        return { enabled: false, locale, reason: "rollout_disabled" };
    /** Provides hash behavior. */
    const hash = (0, exports.hashRaceCohortUser)(userId);
    /** Provides bucket behavior. */
    const bucket = Number.parseInt(hash.slice(0, 8), 16) / 0x1_0000_0000;
    /** Provides enabled behavior. */
    const enabled = config.allowlistHashes.includes(hash) || bucket * 100 < config.percentage;
    return race_1.RaceAccessResponseSchema.parse({
        enabled,
        locale,
        reason: enabled ? "enabled" : "not_in_cohort",
    });
}
/** Loads and evaluates authoritative multiplayer access for a player. */
async function getRaceAccessForUser(userId, locale, dbInput) {
    if (locale !== "en" && !(0, facebookSecurity_1.isFacebookFirebaseUid)(userId) && !(0, redditSecurity_1.isRedditFirebaseUid)(userId)) {
        return { enabled: false, locale, reason: "rollout_disabled" };
    }
    /** Provides db behavior. */
    const db = dbInput ?? firebaseAdmin_1.admin.firestore();
    /** Provides snapshot behavior. */
    const snapshot = await db.doc("raceConfig/rollout").get();
    return evaluateRaceRollout(snapshot.exists ? snapshot.data() : DEFAULT_CONFIG, userId, locale);
}
/** Throws unless the player currently belongs to the enabled race cohort. */
async function assertRaceAccess(userId, locale = "en", dbInput) {
    /** Provides access behavior. */
    const access = await getRaceAccessForUser(userId, locale, dbInput);
    if (!access.enabled)
        throw new https_1.HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
}
/** Records one allowlisted, idempotent multiplayer analytics event. */
async function recordRaceAnalyticsForUser(userId, input, options = {}) {
    /** Provides db behavior. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    await assertRaceAccess(userId, "en", db);
    /** Provides now ms behavior. */
    const nowMs = options.nowMs ?? Date.now();
    /** Provides allowed behavior. */
    const allowed = new Set(race_1.RACE_ANALYTICS_FIELDS[input.eventName]);
    /** Provides params behavior. */
    const params = Object.fromEntries(Object.entries(input.params).filter(([key]) => allowed.has(key)));
    /** Provides document id behavior. */
    const documentId = (0, node_crypto_1.createHash)("sha256").update(`${userId}\u0000${input.eventId}`).digest("hex");
    /** Provides reference behavior. */
    const reference = db.collection("raceAnalytics").doc(documentId);
    try {
        await reference.create({
            eventName: input.eventName,
            params,
            cohortUserHash: (0, exports.hashRaceCohortUser)(userId),
            createdAtMs: nowMs,
            expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + ANALYTICS_RETENTION_MS),
        });
    }
    catch (error) {
        // Firestore's atomic create keeps concurrent/replayed receipts idempotent.
        // All other failures must remain visible to the caller for retry.
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === 6))
            throw error;
    }
    return race_1.RaceAnalyticsEventResponseSchema.parse({ accepted: true });
}
//# sourceMappingURL=raceRollout.js.map