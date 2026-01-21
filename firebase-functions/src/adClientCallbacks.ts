import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";

// Define the expected data structure from the client
interface RewardedAdCompletionData {
  adDetails: {
    placementId?: string;
    creativeId?: string;
    networkName?: string;
    transactionId?: string; // Transaction ID to correlate with S2S postback
  };
}

// Response interface for the client
interface RewardedAdCompletionResponse {
  success: boolean;
  message: string;
  coinsAwarded?: number;
  pendingValidation?: boolean;
}

/**
 * Time window (in milliseconds) to wait for S2S postback validation.
 * Client notifications received within this window of a validated postback
 * will be considered correlated.
 */
const POSTBACK_CORRELATION_WINDOW_MS = 60000; // 60 seconds

/**
 * Checks if a S2S postback has been received and validated for this user recently.
 * This correlates the client-side ad completion with server-side validation.
 *
 * @param userId - The user ID to check
 * @param transactionId - Optional transaction ID to match specific postback
 * @returns The validated postback data if found, null otherwise
 */
async function findValidatedPostback(
  userId: string,
  transactionId?: string
): Promise<{coinsAwarded: number; token: string} | null> {
  try {
    const cutoffTime = new Date(Date.now() - POSTBACK_CORRELATION_WINDOW_MS);

    // Query for recent validated postbacks for this user
    let query = admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("processedAdCallbacks")
      .where("processedAt", ">=", admin.firestore.Timestamp.fromDate(cutoffTime))
      .orderBy("processedAt", "desc")
      .limit(5);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return null;
    }

    // If we have a transaction ID, try to find exact match
    if (transactionId) {
      const exactMatch = snapshot.docs.find((doc) => doc.id === transactionId);
      if (exactMatch) {
        const data = exactMatch.data();
        return {
          coinsAwarded: data.coinsAwarded || 0,
          token: exactMatch.id,
        };
      }
    }

    // Return the most recent validated postback if no exact match
    const mostRecent = snapshot.docs[0];
    const data = mostRecent.data();
    return {
      coinsAwarded: data.coinsAwarded || 0,
      token: mostRecent.id,
    };
  } catch (error) {
    logger.error("Error finding validated postback:", error);
    return null;
  }
}

/**
 * Records a client-side ad completion notification for correlation tracking.
 * This allows tracking client notifications that arrive before S2S postbacks.
 *
 * @param userId - The user ID
 * @param adDetails - Details about the completed ad
 */
async function recordClientNotification(
  userId: string,
  adDetails: RewardedAdCompletionData["adDetails"]
): Promise<void> {
  try {
    await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("pendingAdCompletions")
      .add({
        ...adDetails,
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending_postback",
      });
  } catch (error) {
    logger.error("Error recording client notification:", error);
    // Non-critical, don't throw
  }
}

/**
 * Callable function for the client to notify the server that a rewarded ad
 * has been completed. This function correlates with the S2S postback validation
 * in adCallbacks.ts.
 *
 * Flow:
 * 1. Client completes watching a rewarded ad
 * 2. Client calls this function to notify the server
 * 3. Server checks if a corresponding S2S postback has been validated
 * 4. If validated, confirms the reward; if not, records for later correlation
 *
 * The actual coin awarding is still handled by the S2S postback (adCallbacks.ts)
 * to ensure security. This function provides confirmation to the client.
 */
export const notifyRewardedAdCompleted = onCall(
  async (request: CallableRequest<RewardedAdCompletionData>): Promise<RewardedAdCompletionResponse> => {
    // Ensure the user is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const userId = request.auth.uid;
    const {adDetails} = request.data;

    logger.info(`Rewarded ad completed client-side for user ${userId}. Details: ${JSON.stringify(adDetails)}`);

    // Check if we have a validated S2S postback to correlate with
    const validatedPostback = await findValidatedPostback(userId, adDetails?.transactionId);

    if (validatedPostback) {
      logger.info(
        `Correlated client notification with validated postback for user ${userId}. ` +
          `Token: ${validatedPostback.token}, Coins: ${validatedPostback.coinsAwarded}`
      );

      return {
        success: true,
        message: "Reward confirmed! Coins have been credited to your account.",
        coinsAwarded: validatedPostback.coinsAwarded,
        pendingValidation: false,
      };
    }

    // No validated postback found yet - record the client notification for correlation
    // The S2S postback may arrive shortly after
    await recordClientNotification(userId, adDetails);

    logger.info(`No validated postback found yet for user ${userId}. Client notification recorded.`);

    return {
      success: true,
      message: "Ad completion received. Reward will be credited once validated.",
      pendingValidation: true,
    };
  }
);
