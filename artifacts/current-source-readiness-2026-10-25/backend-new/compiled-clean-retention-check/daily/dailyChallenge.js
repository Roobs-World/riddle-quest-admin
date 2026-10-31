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
exports.getCurrentClassicRiddle = exports.getCurrentDailyChallenge = void 0;
const riddleSupply_1 = require("../riddles/riddleSupply");
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const functions = __importStar(require("firebase-functions"));
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const https_1 = require("firebase-functions/v2/https");
const firestoreService_1 = require("../gameplay/firestoreService");
const sentry_1 = require("../shared/sentry");
const validation_1 = require("@qwordly/core/validation");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
const gameplayCallableOptions_1 = require("../shared/gameplayCallableOptions");
const dailyChallengeProgress_1 = require("./dailyChallengeProgress");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const singlePlayerAnswerPolicy_1 = require("../gameplay/singlePlayerAnswerPolicy");
const singlePlayerSession_1 = require("../gameplay/singlePlayerSession");
const completeGameLogic_1 = require("../gameplay/completeGameLogic");
const errorMetadata_1 = require("../shared/errorMetadata");
const classicRiddleFallback_1 = require("../gameplay/classicRiddleFallback");
const singlePlayerLoadRequest_1 = require("../gameplay/singlePlayerLoadRequest");
const dailyRolloverRecovery_1 = require("./dailyRolloverRecovery");
const singlePlayerTerminalRecovery_1 = require("../gameplay/singlePlayerTerminalRecovery");
const singlePlayerRiddleResponse_1 = require("../gameplay/singlePlayerRiddleResponse");
const zod_1 = require("zod");
const callableValidation_2 = require("../validation/callableValidation");
/** Defines the daily challenge question count value. */
const DAILY_CHALLENGE_QUESTION_COUNT = 1;
/** Daily callers select a language or resume an issued session, never supply content or a date. */
const DailyChallengeLoadSchema = zod_1.z.object({
    locale: zod_1.z.enum(validation_1.SUPPORTED_LOCALES).optional(),
    sessionToken: zod_1.z.string().min(20).max(128).optional(),
    riddleId: zod_1.z.string().min(1).max(160).optional(),
    includeEvaluation: zod_1.z.boolean().optional(),
    includeHintRecovery: zod_1.z.boolean().optional(),
    includeGuessRecovery: zod_1.z.boolean().optional(),
}).strict();
/** Parses only trusted Firestore session timestamps. */
const trustedSessionDate = (value) => {
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
        /** Parses d. */
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
    }
    return undefined;
};
/**
 * Loads only the server-selected dated document for the active language.
 *
 * @returns Fresh challenge snapshot plus today's regional date string.
 */
async function getFreshDailyChallengeDoc(locale = "en") {
    /** Provides today date string behavior. */
    const todayDateString = (0, dailyCalendar_1.getDailyDate)(locale);
    /** Provides safe locale behavior. */
    const safeLocale = locale || "en";
    /** Provides localized riddle collection behavior. */
    const localizedRiddleCollection = firebaseAdmin_1.admin.firestore().collection(`localizedRiddles/${safeLocale}/riddles`);
    /** Provides dated daily challenge doc behavior. */
    const datedDailyChallengeDoc = await localizedRiddleCollection.doc(`daily-${todayDateString}`).get();
    /** Provides daily challenge doc behavior. */
    const dailyChallengeDoc = datedDailyChallengeDoc;
    return { dailyChallengeDoc, todayDateString };
}
/**
 * Gets the current daily challenge data (single question, excluding answer).
 * Returns the daily challenge and the user's progress.
 * Optionally includes the user's completion status if authenticated.
 */
exports.getCurrentDailyChallenge = (0, sentryHandlers_1.onCallWithSentry)("getCurrentDailyChallenge", gameplayCallableOptions_1.gameplayInteractiveCallableOptions, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "The user must be authenticated to load the daily challenge.");
        }
        /** Validated locale, response flags and paired recovery identifiers. */
        const input = (0, callableValidation_2.validateCallableRequest)(DailyChallengeLoadSchema, request.data ?? {}, "getCurrentDailyChallenge");
        /** Provides locale behavior. */
        let locale = "en";
        /** Provides authenticated user behavior. */
        let authenticatedUser;
        authenticatedUser = await (0, firestoreService_1.getUser)(request.auth.uid);
        if (!authenticatedUser)
            throw new https_1.HttpsError("not-found", "User data not found.");
        if (input.locale !== undefined) {
            locale = input.locale;
        }
        else if (authenticatedUser.preferredLanguage &&
            validation_1.SUPPORTED_LOCALES.includes(authenticatedUser.preferredLanguage)) {
            locale = authenticatedUser.preferredLanguage;
        }
        /** Provides resume behavior. */
        const resume = (0, singlePlayerLoadRequest_1.parseSinglePlayerResumeFields)(input);
        /** Provides today date string behavior. */
        const todayDateString = (0, dailyCalendar_1.getDailyDate)(locale);
        if (resume) {
            /** Provides resumed behavior. */
            const resumed = await (0, singlePlayerSession_1.getIssuedAuthoritativeSession)(request.auth.uid, resume.sessionToken, "challenge", resume.riddleId);
            if (resumed.terminal &&
                !resumed.isSkipped &&
                (0, completeGameLogic_1.isDailyCompletionDateEligible)(resumed.challengeDate, resumed.isCorrect, trustedSessionDate(resumed.terminalAt), new Date(), resumed.locale)) {
                await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId: resume.riddleId, gameMode: "challenge", sessionToken: resume.sessionToken }, {
                    uid: request.auth.uid,
                    isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
                });
                authenticatedUser = await (0, firestoreService_1.getUser)(request.auth.uid);
                if (!authenticatedUser)
                    throw new https_1.HttpsError("not-found", "User data not found.");
            }
        }
        else {
            authenticatedUser = await (0, dailyRolloverRecovery_1.reconcilePreviousDailyBinding)(request.auth.uid, authenticatedUser, request.auth.token?.firebase?.sign_in_provider === "anonymous", locale);
        }
        /** Provides completion key behavior. */
        const completionKey = (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("challenge", todayDateString);
        /** Provides progress behavior. */
        let progress = (0, dailyChallengeProgress_1.resolveDailyChallengeProgress)(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
        if (!progress.hasCompletedToday &&
            (await (0, singlePlayerTerminalRecovery_1.recoverPendingAuthoritativeCompletion)(request.auth.uid, "challenge", completionKey, request.auth.token?.firebase?.sign_in_provider === "anonymous"))) {
            authenticatedUser = await (0, firestoreService_1.getUser)(request.auth.uid);
            if (!authenticatedUser)
                throw new https_1.HttpsError("not-found", "User data not found.");
            progress = (0, dailyChallengeProgress_1.resolveDailyChallengeProgress)(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
        }
        if (progress.hasCompletedToday) {
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { ...progress, error: "Today's daily challenge is already complete." }, "getCurrentDailyChallenge");
        }
        /** Provides {daily challenge doc} behavior. */
        const { dailyChallengeDoc } = await getFreshDailyChallengeDoc(locale);
        if (!dailyChallengeDoc.exists) {
            functions.logger.warn("No daily challenge document found.");
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "No daily challenge available at the moment." }, "getCurrentDailyChallenge");
        }
        /** Provides all data behavior. */
        const allData = dailyChallengeDoc.data();
        /** Keep authored difficulty before playable-content validation narrows the clue shape. */
        const difficultyBand = allData?.difficultyBand;
        if (!allData || !(0, classicRiddleFallback_1.isPlayableRiddleContent)(allData)) {
            functions.logger.error("Daily challenge document is missing required playable question data.");
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "Daily challenge data is incomplete. Expected 1 question." }, "getCurrentDailyChallenge");
        }
        /** Provides challenge date behavior. */
        let challengeDate = todayDateString;
        if (allData.timestamp && typeof allData.timestamp === "object" && "toDate" in allData.timestamp) {
            challengeDate = (0, dailyCalendar_1.getDailyDate)(locale, allData.timestamp.toDate());
        }
        /** Provides canonical challenge date behavior. */
        const canonicalChallengeDate = typeof allData.challengeKey === "string" ? allData.challengeKey : challengeDate;
        if (canonicalChallengeDate !== todayDateString) {
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "Today's daily challenge is not available yet." }, "getCurrentDailyChallenge");
        }
        challengeDate = canonicalChallengeDate;
        /** Provides riddle id behavior. */
        const riddleId = `daily-${todayDateString}`;
        if (allData.riddleId !== riddleId || (allData.locale !== undefined && allData.locale !== locale)) {
            throw new https_1.HttpsError("failed-precondition", "Daily content does not match its server-selected date and language.");
        }
        /** Provides canonical riddle behavior. */
        const canonicalRiddle = {
            ...allData,
            riddleId,
            answer: allData.answer,
            difficultyBand,
        };
        /** Provides content key behavior. */
        const contentKey = (0, singlePlayerAnswerPolicy_1.getSinglePlayerContentKey)(canonicalRiddle, "challenge", locale);
        /** The committed issuance attempt provides both identity and public projection inputs. */
        let { sessionToken, state: activeSession } = await (0, singlePlayerSession_1.ensureAuthoritativeSessionWithState)(request.auth.uid, "challenge", riddleId, locale, contentKey, completionKey, canonicalRiddle.answer, { challengeDate: todayDateString, difficultyBand: canonicalRiddle.difficultyBand });
        if (activeSession.terminal &&
            !activeSession.isSkipped &&
            (0, completeGameLogic_1.isDailyCompletionDateEligible)(activeSession.challengeDate, activeSession.isCorrect, trustedSessionDate(activeSession.terminalAt), new Date(), activeSession.locale)) {
            await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId, gameMode: "challenge", sessionToken }, {
                uid: request.auth.uid,
                isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
            });
            authenticatedUser = await (0, firestoreService_1.getUser)(request.auth.uid);
            if (!authenticatedUser)
                throw new https_1.HttpsError("not-found", "User data not found.");
            /** Provides reconciled progress behavior. */
            const reconciledProgress = (0, dailyChallengeProgress_1.resolveDailyChallengeProgress)(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
            if (reconciledProgress.hasCompletedToday) {
                return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { ...reconciledProgress, error: "Today's daily challenge is already complete." }, "getCurrentDailyChallenge");
            }
            // A recorded loss remains retryable for the same Daily entitlement.
            ({ sessionToken, state: activeSession } = await (0, singlePlayerSession_1.ensureAuthoritativeSessionWithState)(request.auth.uid, "challenge", riddleId, locale, contentKey, completionKey, canonicalRiddle.answer, { challengeDate: todayDateString, difficultyBand: canonicalRiddle.difficultyBand }));
        }
        /** Provides challenge data behavior. */
        const challengeData = (0, singlePlayerRiddleResponse_1.buildSinglePlayerChallengeResponse)({ ...canonicalRiddle, locale }, challengeDate, sessionToken, activeSession, input.includeEvaluation === true, input.includeHintRecovery === true, input.includeGuessRecovery === true);
        /** Provides current question behavior. */
        let currentQuestion = undefined;
        /** Indicates whether has completed today. */
        let hasCompletedToday = undefined;
        /** Provides questions completed behavior. */
        let questionsCompleted = undefined;
        ({ currentQuestion, hasCompletedToday, questionsCompleted } = progress);
        functions.logger.info(`Returning daily challenge for ${challengeData.date}: ${DAILY_CHALLENGE_QUESTION_COUNT} question, user progress: ${questionsCompleted}/${DAILY_CHALLENGE_QUESTION_COUNT}`);
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, {
            challenge: challengeData,
            currentQuestion,
            hasCompletedToday,
            questionsCompleted,
        }, "getCurrentDailyChallenge");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        functions.logger.error("Error getting current daily challenge.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error, {
            functionName: "getCurrentDailyChallenge",
            isAuthenticated: !!request.auth,
        });
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "An error occurred while fetching the daily challenge." }, "getCurrentDailyChallenge");
    }
});
/**
 * Gets the current classic riddle for a player's progression index.
 *
 * This is a server-backed fallback so the client can avoid reading the classic
 * collection directly when Firestore rules or App Check prevent it.
 */
exports.getCurrentClassicRiddle = (0, sentryHandlers_1.onCallWithSentry)("getCurrentClassicRiddle", gameplayCallableOptions_1.gameplayCallableOptions, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "The user must be authenticated to load a classic riddle.");
        }
        /** Requests ed classic index. */
        const requestedClassicIndex = request.data?.classicIndex === undefined ? undefined : (0, singlePlayerLoadRequest_1.parseClassicLoadIndex)(request.data.classicIndex);
        /** Provides locale behavior. */
        let locale = "en";
        /** Provides r. */
        let user = await (0, firestoreService_1.getUser)(request.auth.uid);
        if (!user)
            throw new https_1.HttpsError("not-found", "User data not found.");
        if (typeof request.data?.locale === "string" &&
            validation_1.SUPPORTED_LOCALES.includes(request.data.locale)) {
            locale = request.data.locale;
        }
        else if (user?.preferredLanguage &&
            validation_1.SUPPORTED_LOCALES.includes(user.preferredLanguage)) {
            locale = user.preferredLanguage;
        }
        /** Provides resume behavior. */
        let resume;
        try {
            resume = (0, singlePlayerLoadRequest_1.parseSinglePlayerResumeFields)(request.data);
        }
        catch (error) {
            if (!(error instanceof https_1.HttpsError) || error.code !== "invalid-argument")
                throw error;
            functions.logger.warn("Ignoring malformed optional Classic resume fields.", {
                hasSessionToken: request.data?.sessionToken !== undefined,
                hasRiddleId: request.data?.riddleId !== undefined,
            });
        }
        /** Provides reconciled terminal session behavior. */
        let reconciledTerminalSession = false;
        if (resume) {
            /** Provides resumed behavior. */
            const resumed = await (0, singlePlayerSession_1.getIssuedAuthoritativeSession)(request.auth.uid, resume.sessionToken, "classic", resume.riddleId);
            if (resumed.terminal) {
                if (!resumed.isSkipped) {
                    await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId: resume.riddleId, gameMode: "classic", sessionToken: resume.sessionToken }, {
                        uid: request.auth.uid,
                        isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
                    });
                }
                user = await (0, firestoreService_1.getUser)(request.auth.uid);
                if (!user)
                    throw new https_1.HttpsError("not-found", "User data not found.");
                reconciledTerminalSession = true;
            }
        }
        /** Provides expected classic index behavior. */
        let expectedClassicIndex = user.progress?.classicIndex ?? 1;
        if (await (0, singlePlayerTerminalRecovery_1.recoverPendingAuthoritativeCompletion)(request.auth.uid, "classic", (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("classic", expectedClassicIndex), request.auth.token?.firebase?.sign_in_provider === "anonymous")) {
            user = await (0, firestoreService_1.getUser)(request.auth.uid);
            if (!user)
                throw new https_1.HttpsError("not-found", "User data not found.");
            expectedClassicIndex = user.progress?.classicIndex ?? 1;
            reconciledTerminalSession = true;
        }
        if (requestedClassicIndex !== undefined &&
            requestedClassicIndex !== expectedClassicIndex &&
            !reconciledTerminalSession) {
            throw new https_1.HttpsError("permission-denied", "Only the current classic riddle can be loaded.");
        }
        /** Provides classic index behavior. */
        let classicIndex = expectedClassicIndex;
        /** Provides playable behavior. */
        let playable = await (0, classicRiddleFallback_1.getPlayableClassicRiddle)(classicIndex, locale);
        if (!playable) {
            await (0, riddleSupply_1.triggerClassicRiddleGenerationIfNeeded)(request.auth.uid, classicIndex, locale);
            return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE" }, "getCurrentClassicRiddle");
        }
        /** Provides {riddle, content locale} behavior. */
        let { riddle, contentLocale } = playable;
        if (riddle.classicIndex !== undefined && riddle.classicIndex !== expectedClassicIndex) {
            throw new https_1.HttpsError("failed-precondition", "The classic riddle does not match current progression.");
        }
        /** Provides content key behavior. */
        const contentKey = (0, singlePlayerAnswerPolicy_1.getSinglePlayerContentKey)(riddle, "classic", contentLocale);
        /** The committed issuance attempt provides both identity and public projection inputs. */
        let { sessionToken, state: activeSession } = await (0, singlePlayerSession_1.ensureAuthoritativeSessionWithState)(request.auth.uid, "classic", riddle.riddleId, contentLocale, contentKey, (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("classic", expectedClassicIndex), riddle.answer, { classicIndex: expectedClassicIndex, difficultyBand: riddle.difficultyBand });
        if (activeSession.terminal) {
            if (!activeSession.isSkipped) {
                await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId: riddle.riddleId, gameMode: "classic", sessionToken }, {
                    uid: request.auth.uid,
                    isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
                });
            }
            user = await (0, firestoreService_1.getUser)(request.auth.uid);
            if (!user)
                throw new https_1.HttpsError("not-found", "User data not found.");
            /** Provides reconciled index behavior. */
            const reconciledIndex = user.progress?.classicIndex ?? 1;
            if (reconciledIndex !== expectedClassicIndex) {
                classicIndex = reconciledIndex;
                playable = await (0, classicRiddleFallback_1.getPlayableClassicRiddle)(classicIndex, locale);
                if (!playable) {
                    await (0, riddleSupply_1.triggerClassicRiddleGenerationIfNeeded)(request.auth.uid, classicIndex, locale);
                    return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, { error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE" }, "getCurrentClassicRiddle");
                }
                ({ riddle, contentLocale } = playable);
            }
            /** Provides reconciled content key behavior. */
            const reconciledContentKey = (0, singlePlayerAnswerPolicy_1.getSinglePlayerContentKey)(riddle, "classic", contentLocale);
            ({ sessionToken, state: activeSession } = await (0, singlePlayerSession_1.ensureAuthoritativeSessionWithState)(request.auth.uid, "classic", riddle.riddleId, contentLocale, reconciledContentKey, (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("classic", classicIndex), riddle.answer, { classicIndex, difficultyBand: riddle.difficultyBand }));
        }
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetCurrentDailyChallengeResponseSchema, {
            ...(request.data?.includeClassicIndex === true ? { classicIndex } : {}),
            challenge: (0, singlePlayerRiddleResponse_1.buildSinglePlayerChallengeResponse)(riddle, undefined, sessionToken, activeSession, request.data?.includeEvaluation === true, request.data?.includeHintRecovery === true, request.data?.includeGuessRecovery === true),
        }, "getCurrentClassicRiddle");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        functions.logger.error("Error getting current classic riddle.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new https_1.HttpsError("internal", "An error occurred while loading the current classic riddle.");
    }
});
//# sourceMappingURL=dailyChallenge.js.map