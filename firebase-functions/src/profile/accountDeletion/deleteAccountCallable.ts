import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../../shared/callableSecurity";
import {captureException} from "../../shared/sentry";
import {getSafeErrorMetadata} from "../../shared/errorMetadata";
import {deleteAccountForUser} from "./deleteAccountData";
import {onCallWithSentry} from "../../shared/sentryHandlers";
import {isAccountDeletionBusyError} from "../../shared/accountDeletion";
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
      } else {
        await deleteAccountForUser(request.auth.uid);
      }
      return {success: true as const};
    } catch (error) {
      if (isAccountDeletionBusyError(error)) {
        throw new HttpsError("aborted", "Account deletion is waiting for an earlier operation. Retry shortly.");
      }
      logger.error("Account deletion failed.", getSafeErrorMetadata(error));
      captureException(error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "An unexpected error occurred while deleting the account.");
    }
  },
  {skipAccountOperationLease: true},
);
