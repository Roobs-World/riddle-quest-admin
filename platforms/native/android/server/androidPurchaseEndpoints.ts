import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {gameplayInteractiveCallableOptions} from "../../../../firebase-functions/src/shared/gameplayCallableOptions";
import {onCallWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {
  grantAndroidPlayPurchase,
  parseGrantAndroidPurchaseInput,
  parseSyncAndroidSubscriptionsInput,
  syncAndroidPlaySubscriptions,
  type GrantAndroidPurchaseOutput,
  type SyncAndroidSubscriptionsOutput,
} from "./androidPlayCommerce";
import {isAndroidAccountProvider} from "./androidUser";
import {createPlayDeveloperApi, type PlayDeveloperApi} from "./playDeveloperApi";

/** Play client created on first use so cold starts that never sell skip it. */
let playClient: PlayDeveloperApi | null = null;
/** Shared Play client. */
const play = (): PlayDeveloperApi => (playClient ??= createPlayDeveloperApi());

/** Returns the uid of an authenticated Android account or rejects the call. */
function requireAndroidUid(request: CallableRequest<unknown>): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  if (!isAndroidAccountProvider(request.auth.token?.firebase?.sign_in_provider)) {
    throw new HttpsError("permission-denied", "Google Play purchases belong to Android accounts.");
  }
  return request.auth.uid;
}

/** Verifies a Google Play coin purchase and grants it exactly once. */
export const grantAndroidPurchase = onCallWithSentry<unknown, GrantAndroidPurchaseOutput>(
  "grantAndroidPurchase",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Authenticated Android account. */
    const uid = requireAndroidUid(request);
    return grantAndroidPlayPurchase({firestore: admin.firestore(), play: play()}, uid, parseGrantAndroidPurchaseInput(request.data));
  },
);

/** Verifies the device's Google Play subscriptions and mirrors Premium onto the account. */
export const syncAndroidSubscriptions = onCallWithSentry<unknown, SyncAndroidSubscriptionsOutput>(
  "syncAndroidSubscriptions",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Authenticated Android account. */
    const uid = requireAndroidUid(request);
    return syncAndroidPlaySubscriptions(
      {firestore: admin.firestore(), play: play()},
      uid,
      parseSyncAndroidSubscriptionsInput(request.data),
    );
  },
);
