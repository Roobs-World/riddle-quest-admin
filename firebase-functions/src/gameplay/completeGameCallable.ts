import {onCall, HttpsError, type CallableOptions} from "firebase-functions/v2/https";
import {
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
} from "../validation/requestSchemas";
import type {CompleteGameRequestData, CompleteGameResponseData} from "../validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {handleCompleteGameLogic} from "./submitGuessLogic";

export const completeGame = onCall<CompleteGameRequestData, Promise<CompleteGameResponseData>>(
  {secrets: ["OPENAI_API_KEY"]} as CallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const data = validateCallableRequest(CompleteGameRequestDataSchema, request.data, "completeGame");
    const response = await handleCompleteGameLogic(data, {
      uid: request.auth.uid,
      isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
    });
    return validateCallableResponse(CompleteGameResponseDataSchema, response, "completeGame");
  },
);
