"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeGame = void 0;
const https_1 = require("firebase-functions/v2/https");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
const completeGameLogic_1 = require("./completeGameLogic");
const gameplayCallableOptions_1 = require("../shared/gameplayCallableOptions");
const sentryHandlers_1 = require("../shared/sentryHandlers");
/** Completes game. */
exports.completeGame = (0, sentryHandlers_1.onCallWithSentry)("completeGame", gameplayCallableOptions_1.gameplayInteractiveCallableOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Provides data behavior. */
    const data = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.CompleteGameRequestDataSchema, request.data, "completeGame");
    /** Provides response behavior. */
    const response = await (0, completeGameLogic_1.completeAuthoritativeGame)(data, {
        uid: request.auth.uid,
        isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
    });
    return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.CompleteGameResponseDataSchema, response, "completeGame");
});
//# sourceMappingURL=completeGameCallable.js.map