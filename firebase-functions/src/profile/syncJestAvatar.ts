import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {jestFirebaseUid} from "../jest/jestSecurity";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";

/** Fills an empty game avatar from the registered player's Jest profile. */
export const syncJestAvatar = onCallWithSentry(
  "syncJestAvatar",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides uid behavior. */
    const uid = request.auth?.uid;
    /** Provides player id behavior. */
    const playerId = request.auth?.token.jestPlayerId;
    if (
      !uid ||
      request.auth?.token.jestRegistered !== true ||
      typeof playerId !== "string" ||
      jestFirebaseUid(playerId) !== uid
    ) {
      throw new HttpsError("permission-denied", "A registered Jest account is required.");
    }

    /** Provides data behavior. */
    const data = request.data;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).length !== 1 ||
      typeof (
        data as {
          /** Stores avatar url. */
          avatarUrl?: unknown;
        }
      ).avatarUrl !== "string"
    ) {
      throw new HttpsError("invalid-argument", "A Jest avatar URL is required.");
    }
    /** Provides avatar url behavior. */
    const avatarUrl = (
      data as {
        /** Stores avatar url. */
        avatarUrl: string;
      }
    ).avatarUrl;
    if (avatarUrl.length > 2048) throw new HttpsError("invalid-argument", "The Jest avatar URL is too long.");
    /** Provides url behavior. */
    let url: URL;
    try {
      url = new URL(avatarUrl);
    } catch {
      throw new HttpsError("invalid-argument", "The Jest avatar URL is invalid.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.href !== avatarUrl) {
      throw new HttpsError("invalid-argument", "The Jest avatar URL must be HTTPS.");
    }

    /** Provides db behavior. */
    const db = admin.firestore();
    /** Provides user ref behavior. */
    const userRef = db.collection("users").doc(uid);
    /** Provides leaderboard ref behavior. */
    const leaderboardRef = db.collection("leaderboard").doc(uid);
    return db.runTransaction(async (transaction) => {
      /** Provides [user, leaderboard, deletion] behavior. */
      const [user, leaderboard, deletion] = await Promise.all([
        transaction.get(userRef),
        transaction.get(leaderboardRef),
        transaction.get(getJestAccountDeletionRef(db, uid)),
      ]);
      assertJestAccountActive(deletion);
      if (!user.exists) throw new HttpsError("not-found", "Player profile not found.");
      /** Provides existing behavior. */
      const existing = user.get("avatarUrl");
      if (typeof existing === "string" && existing.length > 0) return {avatarUrl: existing};
      transaction.update(userRef, {avatarUrl});
      if (leaderboard.exists) transaction.update(leaderboardRef, {avatarUrl, updatedAt: Date.now()});
      return {avatarUrl};
    });
  },
);
