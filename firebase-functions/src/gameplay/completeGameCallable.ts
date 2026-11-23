import {HttpsError} from "firebase-functions/v2/https";
import {CompleteGameRequestDataSchema, CompleteGameResponseDataSchema} from "../../../src/core/validation/requestSchemas.js";
import type {CompleteGameRequestData, CompleteGameResponseData} from "../../../src/core/validation/requestSchemas.js";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {completeAuthoritativeGame} from "./completeGameLogic";
import {gameplayInteractiveCallableOptions} from "../shared/gameplayCallableOptions";
import {onCallWithSentry} from "../shared/sentryHandlers";

/** Completes game. */
export const completeGame = onCallWithSentry<CompleteGameRequestData, CompleteGameResponseData>(
  "completeGame",
  gameplayInteractiveCallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Provides data behavior. */
    const data = validateCallableRequest(CompleteGameRequestDataSchema, request.data, "completeGame");
    /** Provides response behavior. */
    const response = await completeAuthoritativeGame(data, {
      uid: request.auth.uid,
      isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
    });
    return validateCallableResponse(CompleteGameResponseDataSchema, response, "completeGame");
  },
);
