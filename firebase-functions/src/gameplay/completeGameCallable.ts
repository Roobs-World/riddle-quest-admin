import {HttpsError, type CallableOptions} from "firebase-functions/v2/https";
import {
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
} from "../validation/requestSchemas";
import type {CompleteGameRequestData, CompleteGameResponseData} from "../validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {handleCompleteGameLogic} from "./submitGuessLogic";
import {runGameCompletionOnce} from "./gameCompletionGuard";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";

/** Completes game. */
export const completeGame = onCallWithSentry<CompleteGameRequestData, CompleteGameResponseData>(
  "completeGame",
  {
    ...browserCallableSecurityOptions,
    secrets: ["OPENAI_API_KEY"],
  } as CallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const data = validateCallableRequest(CompleteGameRequestDataSchema, request.data, "completeGame");
    const response = await runGameCompletionOnce(request.auth.uid, data.gameMode, data.riddleId, () =>
      handleCompleteGameLogic(data, {
        uid: request.auth!.uid,
        isAnonymous: request.auth!.token?.firebase?.sign_in_provider === "anonymous",
      }),
    );
    return validateCallableResponse(CompleteGameResponseDataSchema, response, "completeGame");
  },
);
