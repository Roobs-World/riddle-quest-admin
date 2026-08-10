import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../../shared/callableSecurity";
import {captureException} from "../../shared/sentry";
import {deleteAccountForUser} from "./deleteAccountData";

/** Callable boundary for permanent Riddle Quest account deletion. */
export const deleteAccount = onCall(browserCallableSecurityOptions, async (request: CallableRequest<unknown>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  try {
    await deleteAccountForUser(request.auth.uid);
    return {success: true as const};
  } catch (error) {
    logger.error(`Error deleting account for ${request.auth.uid}:`, error);
    captureException(error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An unexpected error occurred while deleting the account.");
  }
});
