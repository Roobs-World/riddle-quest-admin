import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import {REWARDED_AD_COIN_REWARD, REWARDED_AD_IDEMPOTENCY_WINDOW_MS, REWARDED_AD_REWARD_COOLDOWN_MS} from "./constants";
import {captureException} from "./sentry";

const REWARDED_AD_PLACEMENTS = ["loss_continue", "coin_shop"] as const;
type RewardedAdPlacement = (typeof REWARDED_AD_PLACEMENTS)[number];

type AwardedAdCallbackData = {
  userId?: unknown;
  placement?: unknown;
  callbackId?: unknown;
  provider?: unknown;
};

type AwardedAdCallbackResponse = {
  success: boolean;
  placement: RewardedAdPlacement;
  callbackId: string;
  rewardCoins: number;
  newCoins: number;
  alreadyProcessed: boolean;
  message: string;
};

const isRewardedAdPlacement = (value: unknown): value is RewardedAdPlacement =>
  typeof value === "string" && REWARDED_AD_PLACEMENTS.includes(value as RewardedAdPlacement);

const sanitizeDocIdSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120) || "unknown";

const resolveCallbackId = (
  userId: string,
  placement: RewardedAdPlacement,
  callbackId: unknown,
  nowMs: number,
): string => {
  if (typeof callbackId === "string" && callbackId.trim().length > 0) {
    return sanitizeDocIdSegment(callbackId.trim());
  }

  const windowId = Math.floor(nowMs / REWARDED_AD_IDEMPOTENCY_WINDOW_MS);
  return sanitizeDocIdSegment(`${userId}_${placement}_${windowId}`);
};

const resolveProvider = (provider: unknown): string | undefined => {
  if (typeof provider !== "string") {
    return undefined;
  }

  const trimmedProvider = provider.trim();
  if (trimmedProvider.length === 0) {
    return undefined;
  }

  return trimmedProvider.slice(0, 60);
};

/**
 * Records a completed rewarded ad and applies the server-side coin reward once.
 */
export const awardedAdCallback = onCall(
  {enforceAppCheck: true},
  async (request: CallableRequest<AwardedAdCallbackData>): Promise<AwardedAdCallbackResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      const userId = request.data?.userId;
      const placement = request.data?.placement;

      if (typeof userId !== "string" || userId.length === 0) {
        throw new HttpsError("invalid-argument", "A valid userId is required.");
      }

      if (userId !== request.auth.uid) {
        throw new HttpsError(
          "permission-denied",
          "Rewarded ad callbacks can only be recorded for the authenticated user.",
        );
      }

      if (!isRewardedAdPlacement(placement)) {
        throw new HttpsError("invalid-argument", "Invalid rewarded ad placement.");
      }

      const nowMs = Date.now();
      const callbackId = resolveCallbackId(userId, placement, request.data?.callbackId, nowMs);
      const provider = resolveProvider(request.data?.provider);

      const db = admin.firestore();
      const userRef = db.collection("users").doc(userId);
      const callbackRef = userRef.collection("processedAdCallbacks").doc(callbackId);
      const cooldownRef = userRef.collection("pendingAdCompletions").doc(placement);
      const interactionRef = db.collection("adInteractions").doc();

      const response = await db.runTransaction(async (transaction) => {
        const callbackDoc = await transaction.get(callbackRef);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User data not found.");
        }

        const userData = userDoc.data() ?? {};
        const currentCoins = typeof userData.coins === "number" ? userData.coins : 0;

        if (callbackDoc.exists) {
          const callbackData = callbackDoc.data() ?? {};
          const processedNewCoins = typeof callbackData.newCoins === "number" ? callbackData.newCoins : currentCoins;
          const processedRewardCoins =
            typeof callbackData.rewardCoins === "number" ? callbackData.rewardCoins : REWARDED_AD_COIN_REWARD;

          return {
            success: true,
            placement,
            callbackId,
            rewardCoins: processedRewardCoins,
            newCoins: processedNewCoins,
            alreadyProcessed: true,
            message: "Rewarded ad callback already processed.",
          };
        }

        const cooldownDoc = await transaction.get(cooldownRef);
        const cooldownData = cooldownDoc.data() ?? {};
        const cooldownUntilMs = typeof cooldownData.cooldownUntilMs === "number" ? cooldownData.cooldownUntilMs : 0;

        if (cooldownUntilMs > nowMs) {
          throw new HttpsError("resource-exhausted", "Rewarded ad reward is on cooldown for this placement.");
        }

        const newCoins = currentCoins + REWARDED_AD_COIN_REWARD;
        const baseEvent = {
          userId,
          placement,
          callbackId,
          provider,
          rewardCoins: REWARDED_AD_COIN_REWARD,
          newCoins,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAtMs: nowMs,
        };

        transaction.update(userRef, {coins: newCoins});
        transaction.set(callbackRef, {
          ...baseEvent,
          status: "processed",
        });
        transaction.set(cooldownRef, {
          latestCallbackId: callbackId,
          lastAwardedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAwardedAtMs: nowMs,
          cooldownUntilMs: nowMs + REWARDED_AD_REWARD_COOLDOWN_MS,
        });
        transaction.set(interactionRef, {
          ...baseEvent,
          eventType: "rewarded_ad_completed",
        });

        return {
          success: true,
          placement,
          callbackId,
          rewardCoins: REWARDED_AD_COIN_REWARD,
          newCoins,
          alreadyProcessed: false,
          message: "Rewarded ad reward applied.",
        };
      });

      logger.info("Rewarded ad callback processed.", {
        userId,
        placement,
        callbackId,
        alreadyProcessed: response.alreadyProcessed,
        rewardCoins: response.rewardCoins,
      });

      return response;
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Unexpected error processing rewarded ad callback:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while processing the rewarded ad callback.");
    }
  },
);
