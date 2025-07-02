import * as admin from "firebase-admin";

/**
 * Checks if a specific IAP token has been processed for a user.
 * Requires storing processed tokens in Firestore.
 *
 * @param {string} userId - The user ID.
 * @param {string} purchaseToken - Unique purchase token/transaction ID from the
 *   App Store or Google Play.
 * @return {Promise<boolean>} Resolves true if processed, false otherwise.
 */
export async function isPurchaseTokenAlreadyProcessed(userId: string, purchaseToken: string): Promise<boolean> {
  try {
    const transactionDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("processedPurchases")
      .doc(purchaseToken)
      .get();
    return transactionDoc.exists;
  } catch (error) {
    console.error("Error checking if IAP purchase token was processed:", error);
    // Returning true in case of error is a safer default to prevent accidental double awards
    return true;
  }
}

/**
 * Marks an IAP token as processed for a user in Firestore.
 *
 * @param {string} userId - The user ID.
 * @param {string} purchaseToken - Unique purchase token/transaction ID.
 * @param {string} productId - Product ID associated with the purchase.
 * @return {Promise<void>} Resolves when the token is marked as processed.
 */
export async function markPurchaseTokenAsProcessed(
  userId: string,
  purchaseToken: string,
  productId: string,
): Promise<void> {
  try {
    await admin.firestore().collection("users").doc(userId).collection("processedPurchases").doc(purchaseToken).set({
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      productId: productId,
    });
  } catch (error) {
    console.error("Error marking IAP purchase token as processed:", error);
    throw error;
  }
}
