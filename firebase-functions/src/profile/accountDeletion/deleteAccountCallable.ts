import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../../shared/callableSecurity";
import {captureException} from "../../shared/sentry";
import {getSafeErrorMetadata} from "../../shared/errorMetadata";
import {deleteAccountForUser} from "./deleteAccountData";
import {onCallWithSentry} from "../../shared/sentryHandlers";
import {isJestAccountDeletionBusyError} from "../../shared/accountDeletion";
import {isJestFirebaseUid, jestFirebaseUid, jestGenerationFromClaims} from "../../../../platforms/web/jest/server/jestSecurity";
import {deleteJestAccountGeneration} from "../../../../platforms/web/jest/server/jestAccountLifecycle";
import {isFacebookFirebaseUid} from "../../../../platforms/web/facebook/server/facebookSecurity";
import {deleteFacebookAccountGeneration} from "../../../../platforms/web/facebook/server/facebookAccountDeletion";
import {defineSecret} from "firebase-functions/params";

/** Provides facebook uid secret behavior. */
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");

/** Callable boundary for permanent Riddle Quest account deletion. */
export const deleteAccount = onCallWithSentry(
  "deleteAccount",
  {
    ...browserCallableSecurityOptions,
    timeoutSeconds: 540,
    secrets: [facebookUidSecret],
  },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    /** Provides jest player id behavior. */
    const jestPlayerId =
      typeof request.auth.token?.jestPlayerId === "string" && request.auth.token.jestPlayerId.length > 0
        ? request.auth.token.jestPlayerId
        : undefined;
    if (isJestFirebaseUid(request.auth.uid) && !jestPlayerId) {
      throw new HttpsError("failed-precondition", "Refresh the Jest session before deleting this account.");
    }
    if (jestPlayerId && jestFirebaseUid(jestPlayerId, jestGenerationFromClaims(request.auth.token)) !== request.auth.uid) {
      throw new HttpsError("failed-precondition", "The authenticated Jest identity is inconsistent.");
    }
    /** Provides facebook generation behavior. */
    const facebookGeneration =
      request.auth.token?.provider === "facebook" && Number.isSafeInteger(request.auth.token.accountGeneration)
        ? (request.auth.token.accountGeneration as number)
        : undefined;
    if (isFacebookFirebaseUid(request.auth.uid) && facebookGeneration === undefined) {
      throw new HttpsError("failed-precondition", "Refresh the Facebook session before deleting this account.");
    }
    if (facebookGeneration !== undefined && !isFacebookFirebaseUid(request.auth.uid)) {
      throw new HttpsError("failed-precondition", "The authenticated Facebook identity is inconsistent.");
    }
    try {
      if (facebookGeneration !== undefined) {
        await deleteFacebookAccountGeneration(
          {uid: request.auth.uid, accountGeneration: facebookGeneration},
          {uidSecret: facebookUidSecret.value()},
        );
      } else if (jestPlayerId) {
        await deleteJestAccountGeneration(jestPlayerId, request.auth.uid);
      } else {
        await deleteAccountForUser(request.auth.uid, jestPlayerId);
      }
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
  },
  {skipJestAccountOperationLease: true},
);
