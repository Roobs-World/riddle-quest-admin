"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitSinglePlayerGuess = void 0;
const https_1 = require("firebase-functions/v2/https");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
const gameplayCallableOptions_1 = require("../shared/gameplayCallableOptions");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const singlePlayerSession_1 = require("./singlePlayerSession");
const completeGameLogic_1 = require("./completeGameLogic");
/** Submits one replay-safe server-authoritative single-player guess. */
exports.submitSinglePlayerGuess = (0, sentryHandlers_1.onCallWithSentry)("submitSinglePlayerGuess", gameplayCallableOptions_1.gameplayInteractiveCallableOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Provides data behavior. */
    const data = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.SubmitSinglePlayerGuessRequestDataSchema, request.data, "submitSinglePlayerGuess");
    /** Provides result behavior. */
    const result = await (0, singlePlayerSession_1.submitAuthoritativeGuess)(request.auth.uid, data);
    // Terminal guesses durably complete before the response is returned. A
    // retry of the same request reuses both the guess receipt and completion
    // receipt, so a dropped response cannot lose or duplicate progression.
    if (result.gameOver) {
        await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId: data.riddleId, gameMode: data.gameMode, sessionToken: data.sessionToken }, {
            uid: request.auth.uid,
            isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
        });
    }
    return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.SubmitSinglePlayerGuessResponseDataSchema, result, "submitSinglePlayerGuess");
});
//# sourceMappingURL=submitSinglePlayerGuessCallable.js.map