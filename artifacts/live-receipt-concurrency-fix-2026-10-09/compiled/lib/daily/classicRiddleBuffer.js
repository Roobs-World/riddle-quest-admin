"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassicRiddleBuffer = void 0;
const https_1 = require("firebase-functions/v2/https");
const validation_1 = require("@qwordly/core/validation");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const firestoreService_1 = require("../gameplay/firestoreService");
const classicRiddleFallback_1 = require("../gameplay/classicRiddleFallback");
const singlePlayerAnswerPolicy_1 = require("../gameplay/singlePlayerAnswerPolicy");
const singlePlayerSession_1 = require("../gameplay/singlePlayerSession");
const singlePlayerRiddleResponse_1 = require("../gameplay/singlePlayerRiddleResponse");
const gameplayCallableOptions_1 = require("../shared/gameplayCallableOptions");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const dailyChallenge_1 = require("./dailyChallenge");
/** Issues the current Classic question and at most three future session snapshots. */
exports.getClassicRiddleBuffer = (0, sentryHandlers_1.onCallWithSentry)("getClassicRiddleBuffer", gameplayCallableOptions_1.gameplayInteractiveCallableOptions, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    /** Authenticated account owns every prepared session in this buffer. */
    const userId = request.auth.uid;
    if (request.data?.locale !== undefined && !validation_1.SUPPORTED_LOCALES.includes(request.data.locale)) {
        throw new https_1.HttpsError("invalid-argument", "A supported locale is required.");
    }
    // The existing load reconciles a terminal current session before establishing
    // the authoritative base index. Future sessions never advance that index.
    /** The current used by the authoritative operation. */
    const current = await dailyChallenge_1.getCurrentClassicRiddle.run({
        ...request,
        data: { ...request.data, includeEvaluation: true, includeClassicIndex: true },
    });
    /** The user used by the authoritative operation. */
    const user = await (0, firestoreService_1.getUser)(userId);
    if (!user)
        throw new https_1.HttpsError("not-found", "User data not found.");
    /** The confirmed classic index used by the authoritative operation. */
    const confirmedClassicIndex = current.classicIndex ?? user.progress?.classicIndex ?? 1;
    /** The locale used by the authoritative operation. */
    const locale = request.data?.locale ?? user.preferredLanguage ?? "en";
    /** The riddles used by the authoritative operation. */
    const riddles = [];
    /** The current question used by the authoritative operation. */
    const currentQuestion = current.challenge?.questions[0];
    if (currentQuestion) {
        /** The state used by the authoritative operation. */
        const state = await (0, singlePlayerSession_1.getIssuedAuthoritativeSession)(userId, currentQuestion.sessionToken, "classic", currentQuestion.riddleId);
        riddles.push({ classicIndex: confirmedClassicIndex, expiresAtMs: state.expiresAt.toMillis(), question: currentQuestion });
    }
    // Stop at the first catalog gap before issuing any later entitlement.
    /** Contiguous playable successors stop at the first catalog gap. */
    const upcoming = [];
    /** Three read-only catalog positions share one round trip; no later sessions are issued yet. */
    const catalog = currentQuestion ? await Promise.allSettled(Array.from({ length: 3 }, (_, offset) => (0, classicRiddleFallback_1.getPlayableClassicRiddle)(confirmedClassicIndex + offset + 1, locale))) : [];
    for (let offset = 0; offset < catalog.length; offset += 1) {
        /** Canonical catalog position binds the prepared session entitlement. */
        const classicIndex = confirmedClassicIndex + offset + 1;
        /** Rejections beyond the first gap cannot invalidate an otherwise usable contiguous buffer. */
        const result = catalog[offset];
        if (result.status === "rejected")
            throw result.reason;
        /** Localized authored content selected for this canonical catalog position. */
        const playable = result.value;
        if (!playable)
            break;
        upcoming.push({ classicIndex, playable });
    }
    // Each canonical content key owns its binding/session transaction. Preparing
    // at most three independent sessions together avoids serial database trips.
    // All outcomes settle before a required failure can release the callable account lease.
    /** Prepared successor outcomes retain input order while every transaction settles before response or rejection. */
    const futureRiddles = await Promise.allSettled(upcoming.map(async ({ classicIndex, playable }) => {
        /** Extracts the fixture or authority fields required by this transition. */
        const { riddle, contentLocale } = playable;
        /** The committed issuance attempt owns both the token and its response projection inputs. */
        const { sessionToken: token, state } = await (0, singlePlayerSession_1.ensureAuthoritativeSessionWithState)(userId, "classic", riddle.riddleId, contentLocale, (0, singlePlayerAnswerPolicy_1.getSinglePlayerContentKey)(riddle, "classic", contentLocale), (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("classic", classicIndex), riddle.answer, { classicIndex, difficultyBand: riddle.difficultyBand });
        /** Public question carries the issued session and negotiated recovery fields. */
        const question = (0, singlePlayerRiddleResponse_1.buildSinglePlayerChallengeResponse)(riddle, undefined, token, state, true, request.data?.includeHintRecovery === true, request.data?.includeGuessRecovery === true).questions[0];
        return { classicIndex, expiresAtMs: state.expiresAt.toMillis(), question };
    }));
    for (const result of futureRiddles) {
        if (result.status === "rejected")
            throw result.reason;
        riddles.push(result.value);
    }
    return requestSchemas_1.ClassicRiddleBufferResponseSchema.parse({ confirmedClassicIndex, riddles });
});
//# sourceMappingURL=classicRiddleBuffer.js.map