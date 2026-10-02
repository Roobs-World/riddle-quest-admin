import {HttpsError} from "firebase-functions/v2/https";
import {
  SubmitSinglePlayerGuessRequestDataSchema,
  SubmitSinglePlayerGuessResponseDataSchema,
  type SubmitSinglePlayerGuessRequestData,
  type SubmitSinglePlayerGuessResponseData,
} from "@qwordly/core/validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {submitAuthoritativeGuess} from "./singlePlayerSession";
import {completeAuthoritativeGame} from "./completeGameLogic";

/** Submits one replay-safe server-authoritative single-player guess. */
export const submitSinglePlayerGuess = onCallWithSentry<
  SubmitSinglePlayerGuessRequestData,
  SubmitSinglePlayerGuessResponseData
>("submitSinglePlayerGuess", browserCallableSecurityOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  /** Provides data behavior. */
  const data = validateCallableRequest(
    SubmitSinglePlayerGuessRequestDataSchema,
    request.data,
    "submitSinglePlayerGuess",
  );
  /** Provides result behavior. */
  const result = await submitAuthoritativeGuess(request.auth.uid, data);

  // Terminal guesses durably complete before the response is returned. A
  // retry of the same request reuses both the guess receipt and completion
  // receipt, so a dropped response cannot lose or duplicate progression.
  if (result.gameOver) {
    await completeAuthoritativeGame(
      {riddleId: data.riddleId, gameMode: data.gameMode, sessionToken: data.sessionToken},
      {
        uid: request.auth.uid,
        isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
      },
    );
  }
  return validateCallableResponse(SubmitSinglePlayerGuessResponseDataSchema, result, "submitSinglePlayerGuess");
});
