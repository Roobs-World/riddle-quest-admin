"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHint = exports.spendCoins = exports.skipRiddle = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("../shared/constants");
const riddleSupply_1 = require("../riddles/riddleSupply");
const sentry_1 = require("../shared/sentry");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
const gameplayCallableOptions_1 = require("../shared/gameplayCallableOptions");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const singlePlayerSession_1 = require("./singlePlayerSession");
const errorMetadata_1 = require("../shared/errorMetadata");
/**
 * Skips the current riddle by marking it as completed and advancing to the next level/question.
 * @param data - The request data object containing riddleId and gameMode.
 * @param data.riddleId - The ID of the riddle being skipped.
 * @param data.gameMode - The game mode. Daily challenge riddles are rejected.
 * @param context - The context object representing the request context.
 * @return An object containing success status and new progress information.
 */
exports.skipRiddle = (0, sentryHandlers_1.onCallWithSentry)("skipRiddle", gameplayCallableOptions_1.gameplayCallableOptions, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "The user must be authenticated to skip a riddle.");
        }
        /** Provides current user id behavior. */
        const currentUserId = request.auth.uid;
        /** Provides data behavior. */
        const data = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.SkipRiddleRequestSchema, request.data, "skipRiddle", (error) => error.issues.some((issue) => issue.path[0] === "gameMode")
            ? "Invalid game mode specified."
            : "Invalid request payload for skipRiddle.");
        /** Provides {riddle id, game mode, session token, request id} behavior. */
        const { riddleId, gameMode, sessionToken, requestId } = data;
        if (gameMode === "challenge") {
            throw new https_1.HttpsError("failed-precondition", "Daily riddles cannot be skipped.");
        }
        /** Provides result behavior. */
        const result = await (0, singlePlayerSession_1.skipAuthoritativeRiddle)(currentUserId, {
            riddleId,
            gameMode: "classic",
            sessionToken,
            requestId,
        });
        await (0, riddleSupply_1.triggerClassicRiddleGenerationIfNeeded)(currentUserId, result.classicSupply.classicIndex, result.classicSupply.locale);
        /** Provides progress message behavior. */
        const progressMessage = `Advanced to classic level ${result.newProgress.classicIndex}`;
        v2_1.logger.info(`User ${currentUserId} skipped an authorized ${gameMode} riddle. ${progressMessage}`);
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.SkipRiddleResponseSchema, {
            success: true,
            newProgress: result.newProgress,
            message: `Riddle skipped successfully. ${result.costDeducted} coins deducted. ${progressMessage}`,
            costDeducted: result.costDeducted,
            newCoins: result.newCoins,
        }, "skipRiddle");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        v2_1.logger.error("Unexpected error skipping riddle.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new https_1.HttpsError("internal", "An error occurred while skipping the riddle.");
    }
});
/**
 * Callable function to charge the authoritative paid-continue transaction.
 * @param data - The request data.
 * @param data.reason - Always "continue"; hints/skips use dedicated callables.
 * @param context - The CallableContext object.
 * @return {Promise<{ newCoins: number }>} A Promise resolving to the new coin balance.
 */
exports.spendCoins = (0, sentryHandlers_1.onCallWithSentry)("spendCoins", gameplayCallableOptions_1.gameplayCallableOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Provides {game mode, riddle id, session token, request id, amount} behavior. */
    const { gameMode, riddleId, sessionToken, requestId, amount } = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.SpendCoinsRequestSchema, request.data, "spendCoins", (error) => {
        if (error.issues.some((issue) => issue.path[0] === "reason")) {
            return "Invalid reason specified. Only 'continue' is supported.";
        }
        return "Invalid request payload for spendCoins.";
    });
    /** Provides r id. */
    const userId = request.auth.uid;
    try {
        if (amount !== undefined && amount !== constants_1.CONTINUE_COST_COINS) {
            throw new https_1.HttpsError("invalid-argument", `Supplied amount (${amount}) does not match expected cost (${constants_1.CONTINUE_COST_COINS}) for continue.`);
        }
        /** Provides new coins behavior. */
        const newCoins = await (0, singlePlayerSession_1.grantAuthoritativeContinue)(userId, gameMode, riddleId, requestId, sessionToken);
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.SpendCoinsResponseSchema, { newCoins }, "spendCoins");
    }
    catch (error) {
        // Only log unexpected errors, not expected business logic errors
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Log unexpected errors
        v2_1.logger.error("Unexpected error spending coins.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new https_1.HttpsError("internal", "An error occurred while spending coins.");
    }
});
/**
 * Callable function to reveal a single hint letter for an active riddle.
 * Charges `HINT_COST_COINS`, updates riddle state, increments `stats.totalHintsUsed`,
 * evaluates hint-related achievements, and returns the revealed letter index and costs.
 */
exports.getHint = (0, sentryHandlers_1.onCallWithSentry)("getHint", gameplayCallableOptions_1.gameplayCallableOptions, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
        }
        /** Provides data behavior. */
        const data = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.GetHintRequestSchema, request.data, "getHint");
        /** Provides current user id behavior. */
        const currentUserId = request.auth.uid;
        /** Provides result behavior. */
        const result = await (0, singlePlayerSession_1.purchaseAuthoritativeHint)(currentUserId, data);
        v2_1.logger.info(`User ${currentUserId} completed an authorized hint request for ${data.gameMode}.`);
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.GetHintResponseSchema, result, "getHint");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        v2_1.logger.error("Unexpected error in getHint.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred in getHint.");
    }
});
//# sourceMappingURL=gameLogic.js.map