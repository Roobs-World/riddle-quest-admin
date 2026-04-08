import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// import {onRequest} from "firebase-functions/v2/https";
import {Request, Response} from "express";
import * as crypto from "crypto";
import {updateUserCoins} from "./firestoreService";
import {captureException} from "./sentry";

/**
 * Function to verify ad network signature (AppLovin MAX Postback Validation)
 * Implements validation based on AppLovin documentation:
 * https://developers.applovin.com/en/max/adjust/advanced-settings
 *
 * @param userId - The user ID.
 * @param amount - The reward amount.
 * @param token - The transaction ID.
 * @param signature - The signature provided by AppLovin.
 * @param adToken - The ad token provided by AppLovin.
 * @param sdkKey - Your AppLovin SDK Key.
 * @return A promise that resolves to true if the signature is valid and the
 * transaction is not a replay, otherwise false.
 */
async function verifyAdNetworkSignature(
  userId: string,
  amount: string,
  token: string,
  signature: string,
  adToken: string,
  sdkKey: string,
): Promise<boolean> {
  functions.logger.info("Performing AppLovin MAX signature verification.");

  try {
    // 1. Check for replay attacks first to fail fast on duplicates
    const isProcessed = await isAdTransactionAlreadyProcessed(userId, token);
    if (isProcessed) {
      functions.logger.warn(
        `AppLovin transaction token ${token} already processed for user ${userId}. Potential replay attack.`,
      );
      return false;
    }

    const hashedSdkKey = crypto.createHash("sha256").update(sdkKey).digest("hex");

    const dataToHash = `${adToken}${token}${amount}${userId}${hashedSdkKey}`;

    const expectedSignature = crypto.createHash("sha256").update(dataToHash).digest("hex");

    const isValidSignature = expectedSignature === signature;

    if (!isValidSignature) {
      functions.logger.error(
        `AppLovin signature verification failed for user ${userId}, token ${token}. Expected: ${expectedSignature}, Received: ${signature}`,
      );
    }

    return isValidSignature && !isProcessed;
  } catch (error) {
    functions.logger.error("Error during AppLovin signature verification:", error);
    return false;
  }
}

/**
 * Checks if a specific ad transaction token has already been processed for a user.
 * This requires storing processed transaction tokens in your database (e.g., in
 * Firestore).
 * @param userId - The user ID.
 * @param token - The unique transaction token from the ad network callback.
 * @return A promise that resolves to true if the token has been processed, false
 * otherwise.
 */
async function isAdTransactionAlreadyProcessed(userId: string, token: string): Promise<boolean> {
  try {
    const transactionDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("processedAdCallbacks")
      .doc(token)
      .get();
    return transactionDoc.exists;
  } catch (error) {
    functions.logger.error("Error checking if ad transaction was processed:", error);
    captureException(error, {userId, token, fn: "isAdTransactionAlreadyProcessed"});
    return true;
  }
}

/**
 * Marks an ad transaction token as processed for a user.
 * This requires storing processed transaction tokens in your database (e.g., in
 * Firestore).
 *
 * @param userId - The user ID.
 * @param token - The unique transaction token from the ad network callback.
 * @return A promise that resolves when the token is marked as processed.
 */
async function markAdTransactionAsProcessed(userId: string, token: string): Promise<void> {
  try {
    await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("processedAdCallbacks")
      .doc(token)
      .set({processedAt: admin.firestore.FieldValue.serverTimestamp()});
  } catch (error) {
    functions.logger.error("Error marking ad transaction as processed:", error);
    captureException(error, {userId, token, fn: "markAdTransactionAsProcessed"});
    throw error;
  }
}

/**
 * Handles the callback from an ad network to award coins to a user.
 * Implements server-side validation for AppLovin MAX rewarded ad postbacks.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @return A promise that resolves once the operation is completed.
 */
export const awardedAdCallback = functions.https.onRequest(async (req: Request, res: Response): Promise<void> => {
  const applovinSdkKey = process.env.APPLOVIN_SDK_KEY;
  if (!applovinSdkKey) {
    functions.logger.error("Missing required environment variable: APPLOVIN_SDK_KEY (from process.env)");
    res.status(500).send({message: "Server configuration error."});
    return;
  }

  try {
    if (req.method !== "POST") {
      res.status(405).send({message: "Method Not Allowed"});
      return;
    }

    const {user_id: userId, amount, trans_id: transId, ad_token: adToken, signature, event} = req.body;

    functions.logger.info(
      `Received AppLovin callback: userId=${userId}, amount=${amount}, transId=${transId}, adToken=${adToken}, signature=${signature}, event=${event}`,
    );

    if (!userId || !amount || !transId || !adToken || !signature || !event) {
      functions.logger.warn("Missing required AppLovin postback parameters.");
      res.status(400).send({message: "Missing required parameters."});
      return;
    }

    const isRequestValid = await verifyAdNetworkSignature(userId, amount, transId, signature, adToken, applovinSdkKey);

    if (!isRequestValid) {
      functions.logger.warn(
        `AppLovin callback validation failed for user ${userId}. Token: ${transId}. Event: ${event}. Signature: ${signature}`,
      );
      res.status(401).send({message: "Validation failed."});
      return;
    }

    const REWARDED_EVENT_TYPE = "rewarded_video_completed";

    if (event !== REWARDED_EVENT_TYPE) {
      functions.logger.warn(`Received unexpected AppLovin event type: ${event} for user ${userId}.`);
      res.status(400).send({message: "Unexpected event type."});
      return;
    }

    const coinsToAward = parseInt(amount, 10);

    if (isNaN(coinsToAward) || coinsToAward <= 0) {
      functions.logger.error(`Invalid amount received in AppLovin postback for user ${userId}: ${amount}`);
      res.status(400).send({message: "Invalid reward amount."});
      return;
    }

    await updateUserCoins(userId, coinsToAward);

    await markAdTransactionAsProcessed(userId, transId);

    functions.logger.info(
      `Awarded ${coinsToAward} coins to user ${userId} via AppLovin callback for token ${transId}.`,
    );

    res.status(200).send("OK");
  } catch (error) {
    functions.logger.error("Error processing AppLovin reward callback:", error);
    res.status(500).send({message: "An internal server error occurred."});
  }
});
