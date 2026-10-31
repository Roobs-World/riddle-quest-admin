"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditGameplay = exports.REDDIT_GAMEPLAY_OPERATIONS = void 0;
exports.parseRedditGameplayOperation = parseRedditGameplayOperation;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const dailyChallenge_1 = require("../daily/dailyChallenge");
const classicRiddleBuffer_1 = require("../daily/classicRiddleBuffer");
const submitSinglePlayerGuessCallable_1 = require("../gameplay/submitSinglePlayerGuessCallable");
const completeGameCallable_1 = require("../gameplay/completeGameCallable");
const gameLogic_1 = require("../gameplay/gameLogic");
const leaderboard_1 = require("../gameplay/leaderboard");
const firestoreService_1 = require("../gameplay/firestoreService");
const updateUsername_1 = require("../profile/updateUsername");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const redditEndpoints_1 = require("./redditEndpoints");
const redditSecurity_1 = require("./redditSecurity");
const redditFeatureFlags_1 = require("./redditFeatureFlags");
const race_1 = require("@qwordly/core/race");
const raceLiveCallables_1 = require("../race/raceLiveCallables");
const raceLiveFailures_1 = require("../race/raceLiveFailures");
const redditMatchmaking_1 = require("./redditMatchmaking");
const raceRollout_1 = require("../race/raceRollout");
const raceCallables_1 = require("../race/raceCallables");
const redditTournament_1 = require("../race/redditTournament");
const redditLiveRaceProfile_1 = require("./redditLiveRaceProfile");
const redditSocialProfile_1 = require("./redditSocialProfile");
const redditPresence_1 = require("./redditPresence");
const socialSafetyCallables_1 = require("../social/socialSafetyCallables");
const redditCommerceLedger_1 = require("./redditCommerceLedger");
const redditReferrals_1 = require("./redditReferrals");
const validation_1 = require("@qwordly/core/validation");
/** Provides gateway secret behavior. */
const gatewaySecret = (0, params_1.defineSecret)("REDDIT_GATEWAY_SECRET");
/** Provides uid secret behavior. */
const uidSecret = (0, params_1.defineSecret)("REDDIT_UID_SECRET");
/** Every Reddit question, guess and race action shares this endpoint, so one warm instance avoids idle cold starts. */
const options = { secrets: [gatewaySecret, uidSecret], invoker: "public", timeoutSeconds: 60, minInstances: 0 };
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 80 * 1_024;
/** Defines the reddit gameplay operations value. */
exports.REDDIT_GAMEPLAY_OPERATIONS = [
    "gameplay.profile.load",
    "gameplay.riddle.classic",
    "gameplay.riddle.classic-buffer",
    "gameplay.riddle.daily",
    "gameplay.guess.submit",
    "gameplay.game.complete",
    "gameplay.hint.request",
    "gameplay.coins.spend",
    "gameplay.riddle.skip",
    "gameplay.leaderboard.list",
    "gameplay.profile.username",
    "gameplay.race.access",
    "gameplay.race.categories",
    "gameplay.race.start",
    "gameplay.race.ready",
    "gameplay.race.guess",
    "gameplay.race.hint",
    "gameplay.race.skip",
    "gameplay.race.resume",
    "gameplay.race.abandon",
    "gameplay.race.publish",
    "gameplay.race.challenge",
    "gameplay.race.entry",
    "gameplay.race.outcome",
    "gameplay.race.inbox",
    "gameplay.race.match",
    "gameplay.race.live.join",
    "gameplay.race.live.retire",
    "gameplay.race.live.receipt",
    "gameplay.race.live.update",
    "gameplay.race.live.history",
    "gameplay.race.live.inbox",
    "gameplay.race.live.challenge",
    "gameplay.tournament.list",
    "gameplay.tournament.record",
    "gameplay.presence.poll",
    "gameplay.presence.disconnect",
    "gameplay.safety.block",
    "gameplay.safety.report",
    "gameplay.commerce.fulfill",
    "gameplay.commerce.refund",
    "gameplay.referral.issue",
    "gameplay.referral.bind",
];
/** Renders the operations interface. */
const OPERATIONS = new Set(exports.REDDIT_GAMEPLAY_OPERATIONS);
/** Indicates whether is record. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Provides referral locale behavior. */
const referralLocale = (value) => {
    if (typeof value !== "string" || !validation_1.SUPPORTED_LOCALES.includes(value)) {
        throw new Error("invalid-reddit-referral-locale");
    }
    return value;
};
/** Parses reddit gameplay operation. */
function parseRedditGameplayOperation(assertion) {
    /** Provides operation behavior. */
    const operation = isRecord(assertion) ? assertion.operation : undefined;
    if (typeof operation !== "string" || !OPERATIONS.has(operation))
        throw new Error("invalid-reddit-gameplay-operation");
    return operation;
}
/** Provides callable request behavior. */
const callableRequest = (uid, data) => ({
    data,
    auth: { uid, token: { firebase: { sign_in_provider: "custom" } } },
});
/** Provides public profile behavior. */
const publicProfile = async (uid) => {
    /** Provides r. */
    const user = await (0, firestoreService_1.getUser)(uid);
    if (!user)
        throw new Error("reddit-user-not-found");
    return {
        username: user.username,
        coins: user.coins,
        level: user.stats.level,
        xp: user.stats.xp,
        winStreak: user.stats.winStreak,
        gamesPlayed: user.stats.gamesPlayed,
        wins: user.stats.wins,
        achievements: user.unlockedAchievements.map((entry) => entry.achievementId),
        classicIndex: user.progress.classicIndex,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
        dailyChallengeIndex: user.progress.dailyChallengeIndex,
        dailyChallengeCurrentQuestion: user.progress.dailyChallengeCurrentQuestion,
        dailyPuzzlesCompleted: user.stats.dailyPuzzlesCompleted,
        bestStreak: user.stats.bestStreak,
        totalWordsGuessed: user.stats.totalWordsGuessed,
        winRate: user.stats.winRate,
        averageGuesses: user.stats.averageGuesses,
        totalScore: user.stats.totalScore,
        highestLevelClassic: user.stats.highestLevelClassic,
        challengeWins: user.stats.challengeWins,
        totalWins: user.stats.totalWins,
        totalGuessesInWins: user.stats.totalGuessesInWins,
        totalHintsUsed: user.stats.totalHintsUsed,
        multiplayerGamesPlayed: user.stats.multiplayerGamesPlayed,
        multiplayerWins: user.stats.multiplayerWins,
        multiplayerChallengesCreated: user.stats.multiplayerChallengesCreated,
        hasPurchasedApp: user.hasPurchasedApp,
    };
};
/** Provides dispatch behavior. */
const dispatch = async (operation, uid, payload, trustedContext) => {
    switch (operation) {
        case "gameplay.profile.load":
            if (!isRecord(payload) || Object.keys(payload).length !== 0)
                throw new Error("invalid-reddit-profile-payload");
            return (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(uid, 60, () => publicProfile(uid));
        case "gameplay.riddle.classic":
            return dailyChallenge_1.getCurrentClassicRiddle.run(callableRequest(uid, payload));
        case "gameplay.riddle.classic-buffer":
            return classicRiddleBuffer_1.getClassicRiddleBuffer.run(callableRequest(uid, payload));
        case "gameplay.riddle.daily":
            return dailyChallenge_1.getCurrentDailyChallenge.run(callableRequest(uid, payload));
        case "gameplay.guess.submit":
            return submitSinglePlayerGuessCallable_1.submitSinglePlayerGuess.run(callableRequest(uid, payload));
        case "gameplay.game.complete":
            return completeGameCallable_1.completeGame.run(callableRequest(uid, payload));
        case "gameplay.hint.request":
            return gameLogic_1.getHint.run(callableRequest(uid, payload));
        case "gameplay.coins.spend":
            return gameLogic_1.spendCoins.run(callableRequest(uid, payload));
        case "gameplay.riddle.skip":
            return gameLogic_1.skipRiddle.run(callableRequest(uid, payload));
        case "gameplay.leaderboard.list":
            return leaderboard_1.getLeaderboard.run(callableRequest(uid, payload));
        case "gameplay.profile.username":
            return updateUsername_1.updateUsername.run(callableRequest(uid, payload));
        case "gameplay.race.access":
            return raceCallables_1.getRaceAccess.run(callableRequest(uid, payload));
        case "gameplay.race.categories":
            return raceCallables_1.listRaceCategories.run(callableRequest(uid, payload));
        case "gameplay.race.ready":
            return raceCallables_1.readyRaceRun.run(callableRequest(uid, payload));
        case "gameplay.race.start":
            return raceCallables_1.startRaceRun.run(callableRequest(uid, payload));
        case "gameplay.race.guess":
            return raceCallables_1.submitRaceGuess.run(callableRequest(uid, payload));
        case "gameplay.race.hint":
            return raceCallables_1.requestRaceHint.run(callableRequest(uid, payload));
        case "gameplay.race.skip":
            return raceCallables_1.skipRaceRiddle.run(callableRequest(uid, payload));
        case "gameplay.race.resume":
            return raceCallables_1.resumeRaceRun.run(callableRequest(uid, payload));
        case "gameplay.race.abandon":
            return raceCallables_1.abandonRaceRun.run(callableRequest(uid, payload));
        case "gameplay.race.publish":
            return raceCallables_1.publishRaceChallenge.run(callableRequest(uid, payload));
        case "gameplay.race.entry":
            return raceCallables_1.getRaceEntry.run(callableRequest(uid, payload));
        case "gameplay.race.challenge":
            return raceCallables_1.getRaceChallenge.run(callableRequest(uid, payload));
        case "gameplay.race.outcome":
            return raceCallables_1.getRaceOutcome.run(callableRequest(uid, payload));
        case "gameplay.race.inbox":
            return raceCallables_1.listRaceInbox.run(callableRequest(uid, payload));
        case "gameplay.race.live.join":
            return raceLiveCallables_1.joinLiveRace.run(callableRequest(uid, payload));
        case "gameplay.race.live.retire":
            return raceLiveCallables_1.retireLiveRaceJoin.run(callableRequest(uid, payload));
        case "gameplay.race.live.receipt":
            // Pure observation bypasses mutation admission inside its callable; signed nonce and quota remain enforced.
            return raceLiveCallables_1.confirmLiveGuessReceipt.run(callableRequest(uid, payload));
        case "gameplay.race.live.update":
            return raceLiveCallables_1.updateLiveRace.run(callableRequest(uid, payload));
        case "gameplay.race.live.history":
            return raceLiveCallables_1.listLiveRaceHistory.run(callableRequest(uid, payload));
        case "gameplay.race.live.inbox":
            return raceLiveCallables_1.listLiveRaceChallenges.run(callableRequest(uid, payload));
        case "gameplay.race.live.challenge":
            return raceLiveCallables_1.getLiveRaceChallenge.run(callableRequest(uid, payload));
        case "gameplay.race.match": {
            /** Provides input behavior. */
            const input = race_1.FindRedditRaceMatchRequestSchema.parse(payload);
            await (0, raceRollout_1.assertRaceAccess)(uid, input.locale);
            return (0, redditMatchmaking_1.findRedditRaceMatch)(uid, input);
        }
        case "gameplay.tournament.list": {
            /** Provides input behavior. */
            const input = race_1.ListFacebookTournamentRequestSchema.parse(payload);
            await (0, raceRollout_1.assertRaceAccess)(uid, input.locale);
            return race_1.ListFacebookTournamentResponseSchema.parse(await (0, redditTournament_1.listRedditTournamentStandings)(uid, input.locale));
        }
        case "gameplay.tournament.record": {
            /** Provides input behavior. */
            const input = race_1.RecordFacebookTournamentRunRequestSchema.parse(payload);
            await (0, raceRollout_1.assertRaceAccess)(uid, input.locale);
            /** Provides {entry, improved} behavior. */
            const { entry, improved } = await (0, jestAccountDeletion_1.runWithJestAccountOperationLease)(uid, options.timeoutSeconds, () => (0, redditTournament_1.recordRedditTournamentRun)(uid, input));
            return race_1.RecordFacebookTournamentRunResponseSchema.parse({
                tournamentId: entry.tournamentId,
                locale: entry.locale,
                runId: entry.runId,
                adjustedTimeMs: entry.adjustedTimeMs,
                completedAtMs: entry.completedAtMs,
                improved,
                sortOrder: redditTournament_1.REDDIT_TOURNAMENT_SORT_ORDER,
                rewardsEnabled: false,
            });
        }
        case "gameplay.presence.poll": {
            if (!isRecord(payload) || Object.keys(payload).some((key) => !["sessionId", "state", "enabled"].includes(key))) {
                throw new Error("invalid-reddit-presence-payload");
            }
            return (0, redditPresence_1.pollRedditPresence)(uid, payload);
        }
        case "gameplay.presence.disconnect": {
            if (!isRecord(payload) || Object.keys(payload).length !== 1 || typeof payload.sessionId !== "string") {
                throw new Error("invalid-reddit-presence-payload");
            }
            await (0, redditPresence_1.disconnectRedditPresence)(uid, payload.sessionId);
            return { success: true };
        }
        case "gameplay.safety.block":
            return socialSafetyCallables_1.blockRival.run(callableRequest(uid, payload));
        case "gameplay.safety.report":
            return socialSafetyCallables_1.reportRival.run(callableRequest(uid, payload));
        case "gameplay.commerce.fulfill": {
            if (!isRecord(payload) ||
                Object.keys(payload).length !== 4 ||
                typeof payload.orderId !== "string" ||
                typeof payload.productId !== "string" ||
                (payload.environment !== "sandbox" && payload.environment !== "production") ||
                typeof payload.purchasedAtMs !== "number")
                throw new Error("invalid-reddit-commerce-payload");
            return (0, redditCommerceLedger_1.grantVerifiedRedditOrder)(firebaseAdmin_1.admin.firestore(), {
                uid,
                orderId: payload.orderId,
                productId: payload.productId,
                environment: payload.environment,
                purchasedAtMs: payload.purchasedAtMs,
            });
        }
        case "gameplay.commerce.refund": {
            if (!isRecord(payload) ||
                Object.keys(payload).length !== 4 ||
                typeof payload.orderId !== "string" ||
                typeof payload.productId !== "string" ||
                (payload.environment !== "sandbox" && payload.environment !== "production") ||
                typeof payload.refundedAtMs !== "number")
                throw new Error("invalid-reddit-commerce-payload");
            return (0, redditCommerceLedger_1.refundVerifiedRedditOrder)(firebaseAdmin_1.admin.firestore(), {
                orderId: payload.orderId,
                productId: payload.productId,
                environment: payload.environment,
                refundedAtMs: payload.refundedAtMs,
            });
        }
        case "gameplay.referral.issue": {
            if (!isRecord(payload) ||
                Object.keys(payload).length !== 2 ||
                typeof payload.locale !== "string" ||
                (payload.environment !== "sandbox" && payload.environment !== "production") ||
                !trustedContext)
                throw new Error("invalid-reddit-referral-payload");
            return (0, redditReferrals_1.issueRedditReferralToken)(uid, Date.now(), undefined, firebaseAdmin_1.admin.firestore(), {
                locale: referralLocale(payload.locale),
                postId: trustedContext.postId,
                environment: payload.environment,
            });
        }
        case "gameplay.referral.bind": {
            if (!isRecord(payload) ||
                Object.keys(payload).length !== 3 ||
                typeof payload.token !== "string" ||
                typeof payload.locale !== "string" ||
                (payload.environment !== "sandbox" && payload.environment !== "production") ||
                !trustedContext) {
                throw new Error("invalid-reddit-referral-payload");
            }
            return (0, redditReferrals_1.bindRedditReferralToken)(uid, payload.token, Date.now(), firebaseAdmin_1.admin.firestore(), {
                locale: referralLocale(payload.locale),
                postId: trustedContext.postId,
                environment: payload.environment,
            });
        }
    }
};
/** Same-origin Reddit server gateway for existing server-authoritative single-player handlers. */
exports.redditGameplay = (0, sentryHandlers_1.onRequestWithSentry)("redditGameplay", options, async (request, response) => {
    /** The verified guess used by the authoritative operation. */
    let verifiedGuess = false;
    /** Only authenticated matchmaking failures expose the portable recovery contract. */
    let verifiedMatch = false;
    /** Safe live command categories are exposed only after provider identity resolution. */
    let verifiedLive = false;
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    if (request.method !== "POST") {
        response.status(405).json({ error: "method-not-allowed" });
        return;
    }
    if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
        response.status(413).json({ error: "payload-too-large" });
        return;
    }
    if (!(0, redditFeatureFlags_1.isRedditFeatureEnabled)("identity")) {
        response.status(503).json({ error: "reddit-feature-disabled:identity" });
        return;
    }
    if (!(0, redditFeatureFlags_1.isRedditFeatureEnabled)("gameplay")) {
        response.status(503).json({ error: "reddit-feature-disabled:gameplay" });
        return;
    }
    try {
        /** Provides envelope behavior. */
        const envelope = (0, redditEndpoints_1.parseRedditGatewayEnvelope)(request.body);
        /** Provides operation behavior. */
        const operation = parseRedditGameplayOperation(envelope.assertion);
        if (operation.startsWith("gameplay.race.") && !(0, redditFeatureFlags_1.isRedditFeatureEnabled)("matchmaking")) {
            response.status(503).json({ error: "reddit-feature-disabled:matchmaking" });
            return;
        }
        if (operation.startsWith("gameplay.tournament.") && !(0, redditFeatureFlags_1.isRedditFeatureEnabled)("tournaments")) {
            response.status(503).json({ error: "reddit-feature-disabled:tournaments" });
            return;
        }
        if (operation.startsWith("gameplay.presence.") && !(0, redditFeatureFlags_1.isRedditFeatureEnabled)("presence")) {
            response.status(503).json({ error: "reddit-feature-disabled:presence" });
            return;
        }
        if (operation.startsWith("gameplay.commerce.")) {
            /** Provides environment behavior. */
            const environment = isRecord(envelope.payload) ? envelope.payload.environment : undefined;
            if ((environment !== "sandbox" && environment !== "production") || !(0, redditFeatureFlags_1.isRedditCommerceEnabled)(environment)) {
                response.status(503).json({ error: "reddit-feature-disabled:commerce" });
                return;
            }
        }
        if (operation.startsWith("gameplay.referral.") && !(0, redditFeatureFlags_1.isRedditFeatureEnabled)("referrals")) {
            response.status(503).json({ error: "reddit-feature-disabled:referrals" });
            return;
        }
        /** Asserts ion. */
        const assertion = await (0, redditSecurity_1.verifyRedditGatewayAssertion)(envelope.assertion, request.get("x-riddle-quest-reddit-signature") ?? "", {
            gatewaySecret: gatewaySecret.value(),
            expectedAppName: redditEndpoints_1.REDDIT_APP_NAME,
            expectedOperation: operation,
            expectedPayload: envelope.payload,
            consumeNonce: redditEndpoints_1.consumeRedditGatewayNonce,
        });
        verifiedGuess = operation === "gameplay.guess.submit";
        verifiedMatch = operation === "gameplay.race.match";
        /** Malformed inputs stay in the existing quota so rejection cannot bypass request accounting. */
        const liveUpdate = operation === "gameplay.race.live.update" ? race_1.UpdateLiveRaceSchema.safeParse(envelope.payload) : undefined;
        /** Only a schema-valid signed player command receives its separate bounded budget. */
        const quotaOperation = liveUpdate?.success && liveUpdate.data.action !== "poll" ? `${operation}.command` : assertion.operation;
        if (!(await (0, redditEndpoints_1.consumeRedditRequestQuota)(`${assertion.appName}\0${assertion.userId}\0${quotaOperation}`, gatewaySecret.value()))) {
            response.status(429).json({ error: "rate-limited" });
            return;
        }
        /** Provides provider behavior. */
        const provider = await firebaseAdmin_1.admin
            .firestore()
            .collection("providerIdentities")
            .doc((0, redditEndpoints_1.redditProviderIdentityId)(assertion.appName, assertion.userId))
            .get();
        /** Provides identity behavior. */
        const identity = (0, redditEndpoints_1.resolveRedditProviderIdentity)(provider.data(), {
            appName: assertion.appName,
            userId: assertion.userId,
            uidSecret: uidSecret.value(),
        });
        if (identity.needsUidRepair)
            throw new Error("reddit-session-refresh-required");
        verifiedLive = operation === "gameplay.race.live.join" || operation === "gameplay.race.live.update" || operation === "gameplay.race.live.retire" || operation === "gameplay.race.live.receipt";
        /** Provides result behavior. */
        const result = await dispatch(operation, identity.uid, envelope.payload, { postId: assertion.postId });
        response.json({
            ok: true,
            result: operation === "gameplay.race.live.join" || operation === "gameplay.race.live.update"
                ? await (0, redditLiveRaceProfile_1.hydrateRedditLiveRaceProfile)(result, firebaseAdmin_1.admin.firestore(), Date.now())
                : operation.startsWith("gameplay.race.")
                    ? await (0, redditSocialProfile_1.hydrateRedditRaceSocialResult)(operation, envelope.payload, result)
                    : result,
        });
    }
    catch (error) {
        if (verifiedLive) {
            /** Safe rejection semantics permit stale-question recovery through the approved gateway. */
            const failure = (0, raceLiveFailures_1.liveRaceGatewayFailure)(error);
            response.status(failure.status).json(failure.body);
            return;
        }
        if (verifiedMatch) {
            /** No raw exception details, player IDs or answer-bearing payloads reach the gateway. */
            const matchmaking = (0, race_1.classifyRaceMatchFailure)(error);
            /** Portable recovery policy remains intact through the same-origin Devvit proxy. */
            const status = matchmaking.reason === "access-denied" ? 403 : matchmaking.reason === "invalid-request" ? 400 :
                matchmaking.reason === "search-budget-exceeded" ? 429 : matchmaking.recovery === "new-intent" ? 409 : 503;
            response.status(status).json({ error: "race-matchmaking-failed", matchmaking });
            return;
        }
        if (verifiedGuess) {
            /** The code used by the authoritative operation. */
            const code = error instanceof https_1.HttpsError ? error.code : "unknown";
            /** The rejected used by the authoritative operation. */
            const rejected = ["invalid-argument", "permission-denied", "failed-precondition", "not-found", "unauthenticated"].includes(code);
            response.status(rejected ? 409 : 503).json({ error: rejected ? "guess-rejected" : "guess-retryable" });
            return;
        }
        response.status(401).json({ error: "invalid-request" });
    }
});
//# sourceMappingURL=redditGameplayEndpoint.js.map