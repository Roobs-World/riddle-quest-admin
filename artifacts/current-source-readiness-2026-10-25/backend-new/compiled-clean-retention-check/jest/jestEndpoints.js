"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJestReferrals = exports.syncJestSubscriptions = exports.grantJestPurchase = exports.retryJestAccountDeletion = exports.exchangeJestIdentity = exports.MAX_JEST_HTTP_BODY_BYTES = exports.JEST_HTTP_INPUT_LIMITS = exports.selectUngrantedReferralConversions = exports.selectReferralConversions = void 0;
exports.allowJestRequest = allowJestRequest;
exports.parseJestStringBody = parseJestStringBody;
exports.isAllowedJestOrigin = isAllowedJestOrigin;
exports.applyJestCors = applyJestCors;
exports.acceptJestRequest = acceptJestRequest;
exports.resolveSignedPurchase = resolveSignedPurchase;
exports.resolveSignedSubscriptions = resolveSignedSubscriptions;
exports.resolveConflictingSubscriptionSkus = resolveConflictingSubscriptionSkus;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const jestSecurity_1 = require("./jestSecurity");
const jestProductCatalog_1 = require("./jestProductCatalog");
const constants_1 = require("../shared/constants");
const referrals_1 = require("@qwordly/core/referrals");
const sentry_1 = require("../shared/sentry");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const jestPurchaseReceipts_1 = require("./jestPurchaseReceipts");
const jestReferralReceipts_1 = require("./jestReferralReceipts");
const jestUser_1 = require("./jestUser");
const jestAccountDeletion_1 = require("./jestAccountDeletion");
const jestReferralGrant_1 = require("./jestReferralGrant");
const deleteAccountData_1 = require("../profile/accountDeletion/deleteAccountData");
var jestReferralReceipts_2 = require("./jestReferralReceipts");
Object.defineProperty(exports, "selectReferralConversions", { enumerable: true, get: function () { return jestReferralReceipts_2.selectReferralConversions; } });
Object.defineProperty(exports, "selectUngrantedReferralConversions", { enumerable: true, get: function () { return jestReferralReceipts_2.selectUngrantedReferralConversions; } });
/** Provides jest shared secret behavior. */
const jestSharedSecret = (0, params_1.defineSecret)("JEST_SHARED_SECRET");
/** Deterministic deployment policy for browser-reachable, signed Jest HTTP boundaries. */
const jestHttpOptions = { secrets: [jestSharedSecret], invoker: "public" };
/** Defines the jest game id value. */
const JEST_GAME_ID = process.env.JEST_GAME_ID ?? "riddle-quest";
/** Provides configured skus behavior. */
const configuredSkus = new Set((process.env.JEST_PRODUCT_SKUS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean));
/** Provides configured subscription skus behavior. */
const configuredSubscriptionSkus = new Set((process.env.JEST_SUBSCRIPTION_SKUS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean));
/** Provides trusted subscription skus behavior. */
const trustedSubscriptionSkus = new Set(Object.keys(jestProductCatalog_1.JEST_SUBSCRIPTIONS));
/** Provides subscription skus behavior. */
const subscriptionSkus = new Set([...configuredSubscriptionSkus].filter((sku) => trustedSubscriptionSkus.has(sku)));
/** Provides attempts behavior. */
const attempts = new Map();
/** Defines the max rate limit keys value. */
const MAX_RATE_LIMIT_KEYS = 10_000;
/** Maximum UTF-8 byte lengths accepted before any signed payload verification. */
exports.JEST_HTTP_INPUT_LIMITS = {
    playerSigned: 16 * 1_024,
    purchaseSigned: 64 * 1_024,
    subscriptionsSigned: 64 * 1_024,
    referralsSigned: 256_000,
    playerId: 512,
    purchaseToken: 4 * 1_024,
};
/** Maximum raw JSON body size accepted by any Jest HTTP endpoint. */
exports.MAX_JEST_HTTP_BODY_BYTES = 600 * 1_024;
/** Provides allow request behavior. */
function allowJestRequest(ip) {
    if (!isBoundedString(ip, 256))
        return false;
    /** Provides now behavior. */
    const now = Date.now();
    /** Provides current behavior. */
    const current = attempts.get(ip);
    if (current && current.resetAt > now) {
        current.count += 1;
        return current.count <= 30;
    }
    if (current)
        attempts.delete(ip);
    if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
        for (const [key, value] of attempts) {
            if (value.resetAt > now)
                break;
            attempts.delete(key);
        }
    }
    if (attempts.size >= MAX_RATE_LIMIT_KEYS)
        return false;
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
}
/** Validates one exact, bounded string-only JSON request shape. */
function parseJestStringBody(body, limits) {
    if (!isRecord(body))
        throw new Error("invalid-request");
    /** Provides expected fields behavior. */
    const expectedFields = Object.keys(limits);
    /** Provides actual fields behavior. */
    const actualFields = Object.keys(body);
    if (actualFields.length !== expectedFields.length ||
        actualFields.some((field) => !Object.prototype.hasOwnProperty.call(limits, field))) {
        throw new Error("invalid-request");
    }
    /** Parses d. */
    const parsed = {};
    expectedFields.forEach((field) => {
        /** Provides value behavior. */
        const value = body[field];
        if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > limits[field]) {
            throw new Error("invalid-request");
        }
        parsed[field] = value;
    });
    return parsed;
}
/** Returns whether an unknown value is a non-empty UTF-8 string within a fixed byte bound. */
function isBoundedString(value, maxBytes) {
    return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maxBytes;
}
/** Provides allowed jest origins behavior. */
function allowedJestOrigins() {
    /** Provides origins behavior. */
    const origins = new Set((process.env.JEST_GAME_ORIGIN ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean));
    /** Provides game id behavior. */
    const gameId = process.env.JEST_GAME_ID ?? JEST_GAME_ID;
    if (gameId)
        origins.add(`https://${gameId}.builds.jest.com`);
    return origins;
}
/** Returns whether a browser origin is explicitly trusted for Jest backend calls. */
function isAllowedJestOrigin(origin) {
    return typeof origin === "string" && allowedJestOrigins().has(origin);
}
/** Applies jest cors. */
function applyJestCors(response, origin) {
    if (isAllowedJestOrigin(origin))
        response.set("Access-Control-Allow-Origin", origin);
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Max-Age", "3600");
    response.set("Vary", "Origin");
    response.set("Cache-Control", "no-store");
    response.set("Referrer-Policy", "no-referrer");
    response.set("X-Content-Type-Options", "nosniff");
}
/** Provides rejection behavior. */
function rejection(error) {
    /** Provides reason behavior. */
    const reason = error instanceof Error ? error.message : "invalid-request";
    firebase_functions_1.logger.warn("Rejected Jest platform request", { reason });
    return "invalid-request";
}
/**
 * Applies the HTTP boundary policy shared by all signed Jest endpoints.
 *
 * @param request Incoming Firebase HTTP request.
 * @param response Response adapter used to emit boundary failures.
 * @returns `true` only for trusted, rate-limited JSON POST requests.
 */
function acceptJestRequest(request, response) {
    /** Provides origin behavior. */
    const origin = request.get("origin");
    applyJestCors(response, origin);
    if (!isAllowedJestOrigin(origin)) {
        response.status(403).json({ error: "forbidden-origin" });
        return false;
    }
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return false;
    }
    if (request.method !== "POST") {
        response.status(405).json({ error: "method-not-allowed" });
        return false;
    }
    if (!request.is("application/json")) {
        response.status(415).json({ error: "unsupported-media-type" });
        return false;
    }
    /** Provides raw body behavior. */
    const rawBody = request.rawBody;
    if (rawBody && rawBody.byteLength > exports.MAX_JEST_HTTP_BODY_BYTES) {
        response.status(413).json({ error: "payload-too-large" });
        return false;
    }
    if (!allowJestRequest(request.ip ?? "unknown")) {
        response.status(429).json({ error: "rate-limited" });
        return false;
    }
    return true;
}
/** Verifies and returns the bounded player identity carried by a fresh signed assertion. */
const resolveSignedJestPlayer = (playerSigned) => {
    /** Provides payload behavior. */
    const payload = (0, jestSecurity_1.verifyJestSigned)(playerSigned, jestSharedSecret.value(), JEST_GAME_ID, undefined, undefined, 15 * 60);
    if (!payload.player ||
        !isBoundedString(payload.sub, exports.JEST_HTTP_INPUT_LIMITS.playerId) ||
        !isBoundedString(payload.player.playerId, exports.JEST_HTTP_INPUT_LIMITS.playerId) ||
        payload.player.playerId !== payload.sub ||
        typeof payload.player.registered !== "boolean")
        throw new Error("invalid-player");
    return payload.player;
};
/** Provides exchange jest identity behavior. */
exports.exchangeJestIdentity = (0, sentryHandlers_1.onRequestWithSentry)("exchangeJestIdentity", { ...jestHttpOptions, minInstances: 0 }, async (request, response) => {
    if (!acceptJestRequest(request, response))
        return;
    try {
        /** Provides {player signed} behavior. */
        const { playerSigned } = parseJestStringBody(request.body, { playerSigned: exports.JEST_HTTP_INPUT_LIMITS.playerSigned });
        /** Provides player behavior. */
        const player = resolveSignedJestPlayer(playerSigned);
        /** Provides uid behavior. */
        const uid = (0, jestSecurity_1.jestFirebaseUid)(player.playerId);
        /** Provides firestore behavior. */
        const firestore = firebaseAdmin_1.admin.firestore();
        /** Provides r ref. */
        const userRef = firestore.collection("users").doc(uid);
        await firestore.runTransaction(async (transaction) => {
            /** Provides [user snapshot, deletion snapshot] behavior. */
            const [userSnapshot, deletionSnapshot] = await Promise.all([
                transaction.get(userRef),
                transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, uid)),
            ]);
            (0, jestAccountDeletion_1.assertJestAccountActive)(deletionSnapshot);
            if (userSnapshot.exists)
                return;
            transaction.create(userRef, (0, jestUser_1.createReservedJestUser)(transaction, firestore, uid, player.playerId));
        });
        /** Provides custom token behavior. */
        const customToken = await firebaseAdmin_1.admin
            .auth()
            .createCustomToken(uid, { jestPlayerId: player.playerId, jestRegistered: player.registered });
        // Token creation is outside Firestore. Recheck the permanent guard before
        // returning it; the retained disabled Auth sentinel covers the remaining
        // response/redemption race after this read.
        (0, jestAccountDeletion_1.assertJestAccountActive)(await (0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, uid).get());
        response.json({ customToken, uid });
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.respondToDeletedJestAccount)(error, response))
            return;
        (0, sentry_1.captureException)(error, { firebaseFunction: "exchangeJestIdentity" });
        await (0, sentry_1.flushSentry)();
        response.status(401).json({ error: rejection(error) });
    }
});
/** Retries authoritative deletion from a fresh signed platform assertion without minting Firebase credentials. */
exports.retryJestAccountDeletion = (0, sentryHandlers_1.onRequestWithSentry)("retryJestAccountDeletion", { ...jestHttpOptions, timeoutSeconds: 540 }, async (request, response) => {
    if (!acceptJestRequest(request, response))
        return;
    try {
        /** Provides {player signed} behavior. */
        const { playerSigned } = parseJestStringBody(request.body, { playerSigned: exports.JEST_HTTP_INPUT_LIMITS.playerSigned });
        /** Provides player behavior. */
        const player = resolveSignedJestPlayer(playerSigned);
        await (0, deleteAccountData_1.deleteAccountForUser)((0, jestSecurity_1.jestFirebaseUid)(player.playerId), player.playerId);
        response.json({ accountDeleted: true });
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.isJestAccountDeletionBusyError)(error)) {
            response.status(409).json({ error: "account-deletion-in-progress" });
            return;
        }
        (0, sentry_1.captureException)(error, { firebaseFunction: "retryJestAccountDeletion" });
        await (0, sentry_1.flushSentry)();
        response.status(400).json({ error: rejection(error) });
    }
});
/** Provides grant jest purchase behavior. */
exports.grantJestPurchase = (0, sentryHandlers_1.onRequestWithSentry)("grantJestPurchase", jestHttpOptions, async (request, response) => {
    if (!acceptJestRequest(request, response))
        return;
    try {
        /** Provides {purchase signed, player id, purchase token: requested token} behavior. */
        const { purchaseSigned, playerId, purchaseToken: requestedToken, } = parseJestStringBody(request.body, {
            purchaseSigned: exports.JEST_HTTP_INPUT_LIMITS.purchaseSigned,
            playerId: exports.JEST_HTTP_INPUT_LIMITS.playerId,
            purchaseToken: exports.JEST_HTTP_INPUT_LIMITS.purchaseToken,
        });
        /** Provides payload behavior. */
        const payload = (0, jestSecurity_1.verifyJestSigned)(purchaseSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
        /** Provides {purchase token, product sku, coins} behavior. */
        const { purchaseToken, productSku, coins } = resolveSignedPurchase(payload, requestedToken, configuredSkus);
        /** Provides uid behavior. */
        const uid = (0, jestSecurity_1.jestFirebaseUid)(playerId);
        /** Provides firestore behavior. */
        const firestore = firebaseAdmin_1.admin.firestore();
        /** Provides grant collection behavior. */
        const grantCollection = firestore.collection("jestPurchaseGrants");
        /** Provides purchase token hash behavior. */
        const purchaseTokenHash = (0, jestPurchaseReceipts_1.createJestPurchaseGrantId)(purchaseToken);
        /** Provides ref behavior. */
        const ref = grantCollection.doc(purchaseTokenHash);
        /** Provides legacy ref behavior. */
        const legacyRef = (0, jestPurchaseReceipts_1.isSafeLegacyJestPurchaseGrantId)(purchaseToken) && purchaseToken !== purchaseTokenHash
            ? grantCollection.doc(purchaseToken)
            : undefined;
        /** Provides r ref. */
        const userRef = firestore.collection("users").doc(uid);
        /** Provides deletion ref behavior. */
        const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, uid);
        /** Provides already processed behavior. */
        let alreadyProcessed = false;
        /** Provides new coins behavior. */
        let newCoins = 0;
        /** Provides newly unlocked achievement ids behavior. */
        let newlyUnlockedAchievementIds = [];
        await firestore.runTransaction(async (transaction) => {
            /** Provides [grant snapshot, legacy grant snapshot, user snapshot, deletion snapshot] behavior. */
            const [grantSnapshot, legacyGrantSnapshot, userSnapshot, deletionSnapshot] = await Promise.all([
                transaction.get(ref),
                legacyRef ? transaction.get(legacyRef) : Promise.resolve(undefined),
                transaction.get(userRef),
                transaction.get(deletionRef),
            ]);
            (0, jestAccountDeletion_1.assertJestAccountActive)(deletionSnapshot);
            if (grantSnapshot.exists || legacyGrantSnapshot?.exists) {
                alreadyProcessed = true;
                newCoins = (0, jestPurchaseReceipts_1.currentJestCoinBalance)(userSnapshot.exists ? userSnapshot.data() : undefined);
                if (!grantSnapshot.exists && legacyGrantSnapshot?.exists && legacyRef) {
                    /** Provides legacy grant behavior. */
                    const legacyGrant = legacyGrantSnapshot.data();
                    transaction.create(ref, {
                        purchaseTokenHash,
                        replayProtection: true,
                        productSku: typeof legacyGrant?.productSku === "string" ? legacyGrant.productSku : productSku,
                        coins: typeof legacyGrant?.coins === "number" ? legacyGrant.coins : coins,
                        grantedAt: legacyGrant?.grantedAt ?? firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    transaction.delete(legacyRef);
                }
                return;
            }
            /** Provides r. */
            const user = userSnapshot.exists
                ? userSnapshot.data()
                : (0, jestUser_1.createReservedJestUser)(transaction, firestore, uid, playerId);
            /** Provides current coins behavior. */
            const currentCoins = typeof user.coins === "number" ? user.coins : 0;
            /** Provides unlocked achievements behavior. */
            const unlockedAchievements = Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : [];
            /** Provides first purchase unlocked behavior. */
            const firstPurchaseUnlocked = unlockedAchievements.some((achievement) => typeof achievement === "object" && achievement !== null && achievement.achievementId === "first_purchase");
            newlyUnlockedAchievementIds = firstPurchaseUnlocked ? [] : ["first_purchase"];
            /** Provides achievement bonus behavior. */
            const achievementBonus = newlyUnlockedAchievementIds.length * constants_1.ACHIEVEMENT_UNLOCK_COIN_REWARD;
            newCoins = currentCoins + coins + achievementBonus;
            /** Updates s. */
            const updates = {
                coins: newCoins,
                hasPurchasedApp: true,
                lastLogin: Date.now(),
                unlockedAchievements: firstPurchaseUnlocked
                    ? unlockedAchievements
                    : [...unlockedAchievements, { achievementId: "first_purchase", unlockedAt: Date.now() }],
            };
            if (userSnapshot.exists)
                transaction.update(userRef, updates);
            else
                transaction.create(userRef, { ...user, ...updates });
            transaction.create(ref, {
                purchaseTokenHash,
                replayProtection: true,
                productSku,
                coins,
                grantedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        response.json({
            granted: true,
            alreadyProcessed,
            purchaseToken,
            coinsAwarded: coins,
            newCoins,
            newlyUnlockedAchievementIds,
        });
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.respondToDeletedJestAccount)(error, response))
            return;
        (0, sentry_1.captureException)(error, { firebaseFunction: "grantJestPurchase" });
        await (0, sentry_1.flushSentry)();
        response.status(400).json({ error: rejection(error) });
    }
});
/** Provides sync jest subscriptions behavior. */
exports.syncJestSubscriptions = (0, sentryHandlers_1.onRequestWithSentry)("syncJestSubscriptions", jestHttpOptions, async (request, response) => {
    if (!acceptJestRequest(request, response))
        return;
    try {
        /** Provides {subscriptions signed, player id} behavior. */
        const { subscriptionsSigned, playerId } = parseJestStringBody(request.body, {
            subscriptionsSigned: exports.JEST_HTTP_INPUT_LIMITS.subscriptionsSigned,
            playerId: exports.JEST_HTTP_INPUT_LIMITS.playerId,
        });
        /** Provides payload behavior. */
        const payload = (0, jestSecurity_1.verifyJestSigned)(subscriptionsSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
        /** Provides subscriptions behavior. */
        const subscriptions = resolveSignedSubscriptions(payload, subscriptionSkus);
        /** Provides active skus behavior. */
        const activeSkus = subscriptions
            .filter((subscription) => subscription.status === "active")
            .map((subscription) => subscription.sku);
        /** Provides blocked skus behavior. */
        const blockedSkus = resolveConflictingSubscriptionSkus(activeSkus, subscriptionSkus);
        /** Provides uid behavior. */
        const uid = (0, jestSecurity_1.jestFirebaseUid)(playerId);
        /** Provides firestore behavior. */
        const firestore = firebaseAdmin_1.admin.firestore();
        /** Provides r ref. */
        const userRef = firestore.collection("users").doc(uid);
        /** Provides deletion ref behavior. */
        const deletionRef = (0, jestAccountDeletion_1.getJestAccountDeletionRef)(firestore, uid);
        /** Coins granted by this sync for an active Premium subscription. */
        let premiumCoinsAwarded = 0;
        /** Coin balance after this sync, when the user record is known. */
        let newCoins = 0;
        await firestore.runTransaction(async (transaction) => {
            /** Provides [user snapshot, deletion snapshot] behavior. */
            const [userSnapshot, deletionSnapshot] = await Promise.all([
                transaction.get(userRef),
                transaction.get(deletionRef),
            ]);
            (0, jestAccountDeletion_1.assertJestAccountActive)(deletionSnapshot);
            /** Existing or newly reserved user record. */
            const user = userSnapshot.exists
                ? userSnapshot.data()
                : (0, jestUser_1.createReservedJestUser)(transaction, firestore, uid, playerId);
            /** Server clock for this grant decision. */
            const now = Date.now();
            premiumCoinsAwarded = (0, jestProductCatalog_1.resolvePremiumCoinGrant)(activeSkus.length > 0, user.premiumCoinsGrantedAt, now);
            /** Current coin balance before any Premium grant. */
            const currentCoins = typeof user.coins === "number" ? user.coins : 0;
            newCoins = currentCoins + premiumCoinsAwarded;
            /** Updates s. */
            const updates = {
                hasActiveSubscription: activeSkus.length > 0,
                jestSubscriptions: {
                    activeSkus,
                    verifiedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                },
                lastLogin: now,
                ...(premiumCoinsAwarded > 0 ? { coins: newCoins, premiumCoinsGrantedAt: now } : {}),
            };
            if (userSnapshot.exists)
                transaction.update(userRef, updates);
            else
                transaction.create(userRef, { ...user, ...updates });
        });
        response.json({ verified: true, activeSkus, blockedSkus, premiumCoinsAwarded, newCoins });
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.respondToDeletedJestAccount)(error, response))
            return;
        (0, sentry_1.captureException)(error, { firebaseFunction: "syncJestSubscriptions" });
        await (0, sentry_1.flushSentry)();
        response.status(400).json({ error: rejection(error) });
    }
});
/** Provides verify jest referrals behavior. */
exports.verifyJestReferrals = (0, sentryHandlers_1.onRequestWithSentry)("verifyJestReferrals", jestHttpOptions, async (request, response) => {
    if (!acceptJestRequest(request, response))
        return;
    try {
        /** Provides {referrals signed, player id} behavior. */
        const { referralsSigned, playerId } = parseJestStringBody(request.body, {
            referralsSigned: exports.JEST_HTTP_INPUT_LIMITS.referralsSigned,
            playerId: exports.JEST_HTTP_INPUT_LIMITS.playerId,
        });
        /** Provides payload behavior. */
        const payload = (0, jestSecurity_1.verifyJestSigned)(referralsSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
        /** Provides unique conversions behavior. */
        const uniqueConversions = (0, jestReferralReceipts_1.selectReferralConversions)(payload, playerId);
        /** Provides firestore behavior. */
        const firestore = firebaseAdmin_1.admin.firestore();
        /** Provides ungranted candidates behavior. */
        const ungrantedCandidates = await (0, jestReferralReceipts_1.selectUngrantedReferralConversions)(uniqueConversions, async (batch) => (await firestore.getAll(...batch.map((conversion) => firestore.collection("jestReferralRewards").doc(
        // Preserve the campaign-independent receipt identity.
        (0, jestReferralReceipts_1.createJestReferralRewardId)(playerId, conversion.playerId))))).map((snapshot) => snapshot.exists));
        /** Provides {rewards granted, new coins} behavior. */
        const { rewardsGranted, newCoins } = await (0, jestReferralGrant_1.grantJestReferralRewards)(firestore, playerId, uniqueConversions, ungrantedCandidates);
        response.json({
            verified: true,
            references: [...new Set(uniqueConversions.map((conversion) => conversion.reference))],
            conversionCount: uniqueConversions.length,
            rewardsGranted,
            referredRewardsGranted: rewardsGranted,
            coinsPerPlayer: referrals_1.JEST_REFERRAL_REWARD_COINS,
            newCoins,
        });
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.respondToDeletedJestAccount)(error, response))
            return;
        (0, sentry_1.captureException)(error, { firebaseFunction: "verifyJestReferrals" });
        await (0, sentry_1.flushSentry)();
        response.status(400).json({ error: rejection(error) });
    }
});
/** Indicates whether is record. */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Resolves signed purchase. */
function resolveSignedPurchase(payload, requestedToken, allowedSkus = configuredSkus) {
    return (0, jestProductCatalog_1.resolveJestSignedPurchase)(payload, requestedToken, allowedSkus);
}
/** Resolves signed subscriptions. */
function resolveSignedSubscriptions(payload, allowedSkus = subscriptionSkus) {
    return (0, jestProductCatalog_1.resolveJestSignedSubscriptions)(payload, allowedSkus);
}
/** Resolves conflicting subscription skus. */
function resolveConflictingSubscriptionSkus(activeSkus, allowedSkus = subscriptionSkus, entitlementCatalog = jestProductCatalog_1.JEST_SUBSCRIPTIONS) {
    return (0, jestProductCatalog_1.resolveJestConflictingSubscriptionSkus)(activeSkus, allowedSkus, entitlementCatalog);
}
//# sourceMappingURL=jestEndpoints.js.map