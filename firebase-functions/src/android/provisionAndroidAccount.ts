import {androidGoogleIdentity, registerAndroidReferralIdentity} from "./androidReferralIdentity";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {gameplayInteractiveCallableOptions} from "../shared/gameplayCallableOptions";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {createReservedAndroidUser, isAndroidAccountProvider} from "./androidUser";

/** Response of {@link provisionAndroidAccount}. */
export type ProvisionAndroidAccountResponse = {
  /** Firebase uid that now owns a Global Game Account. */
  uid: string;
  /** Whether this call created the account rather than finding it. */
  created: boolean;
  /** Current confirmed coin balance. */
  coins: number;
};

/**
 * Creates the Global Game Account for an authenticated Android player.
 *
 * @remarks
 * Firestore rules forbid client-side user creation so starting coins, progress,
 * and stats cannot be forged. The Android app signs in to Firebase anonymously
 * (later linkable to Google) and calls this once per installation; repeated
 * calls return the existing account unchanged. Like every browser-facing
 * callable it requires App Check outside the emulator.
 */
export const provisionAndroidAccount = onCallWithSentry<Record<string, never> | undefined, ProvisionAndroidAccountResponse>(
  "provisionAndroidAccount",
  gameplayInteractiveCallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Firebase sign-in provider presented by the caller. */
    const provider = request.auth.token?.firebase?.sign_in_provider;
    if (!isAndroidAccountProvider(provider)) {
      throw new HttpsError("permission-denied", "Android accounts are provisioned only for anonymous or Google sign-in.");
    }
    /** Authenticated Firebase uid. */
    const uid = request.auth.uid;
    /** Firestore holding Global Game Accounts. */
    const firestore = admin.firestore();
    /** Canonical account document. */
    const userRef = firestore.collection("users").doc(uid);
    /** Canonical provisioned account retained while optional Google replay identity is registered. */
    const result = await firestore.runTransaction(async (transaction) => {
      /** Existing account, if any. */
      const snapshot = await transaction.get(userRef);
      if (snapshot.exists) {
        /** Stored balance of the existing account. */
        const coins = snapshot.get("coins");
        return {uid, created: false, coins: typeof coins === "number" ? coins : 0};
      }
      /** Fresh account with its reserved username. */
      const user = createReservedAndroidUser(transaction, firestore, uid, provider);
      transaction.create(userRef, user);
      return {uid, created: true, coins: Number(user.coins)};
    });
    if (provider === "google.com") await registerAndroidReferralIdentity(firestore, androidGoogleIdentity(uid, request.auth.token));
    return result;
  },
);
