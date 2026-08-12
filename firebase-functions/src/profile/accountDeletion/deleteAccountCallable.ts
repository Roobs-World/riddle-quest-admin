import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../../shared/callableSecurity";
import {captureException} from "../../shared/sentry";
import {getSafeErrorMetadata} from "../../shared/errorMetadata";
import {deleteAccountForUser} from "./deleteAccountData";
import {onCallWithSentry} from "../../shared/sentryHandlers";
import {isJestAccountDeletionBusyError} from "../../jest/jestAccountDeletion";
import {isJestFirebaseUid, jestFirebaseUid} from "../../jest/jestSecurity";

/** Callable boundary for permanent Riddle Quest account deletion. */
export const deleteAccount = onCallWithSentry("deleteAccount", {...browserCallableSecurityOptions, timeoutSeconds: 540}, async (request: CallableRequest<unknown>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  const jestPlayerId = typeof request.auth.token?.jestPlayerId === "string" &&
    request.auth.token.jestPlayerId.length > 0
    ? request.auth.token.jestPlayerId
    : undefined;
  if (isJestFirebaseUid(request.auth.uid) && !jestPlayerId) {
    throw new HttpsError("failed-precondition", "Refresh the Jest session before deleting this account.");
  }
  if (jestPlayerId && jestFirebaseUid(jestPlayerId) !== request.auth.uid) {
    throw new HttpsError("failed-precondition", "The authenticated Jest identity is inconsistent.");
  }
  try {
    await deleteAccountForUser(request.auth.uid, jestPlayerId);
    return {success: true as const};
  } catch (error) {
    if (isJestAccountDeletionBusyError(error)) {
      throw new HttpsError("aborted", "Account deletion is waiting for an earlier operation. Retry shortly.");
    }
    logger.error("Account deletion failed.", getSafeErrorMetadata(error));
    captureException(error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An unexpected error occurred while deleting the account.");
  }
}, {skipJestAccountOperationLease: true});
