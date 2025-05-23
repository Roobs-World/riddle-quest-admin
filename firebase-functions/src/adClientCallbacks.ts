import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";

// Define the expected data structure from the client
interface RewardedAdCompletionData {
  adDetails: {
    // Adjust the structure based on what details you send from the client
    placementId?: string;
    creativeId?: string;
    networkName?: string;
    // Add other relevant ad details here
  };
}

// This is a placeholder callable function for the client to notify the server
// that a rewarded ad has been completed. The actual coin awarding should
// still be triggered by the server-to-server postback validation in adCallbacks.ts,
// but this function can be used to correlate client events or potentially
// trigger the award *after* postback validation is confirmed.
export const notifyRewardedAdCompleted = onCall(async (request: CallableRequest<RewardedAdCompletionData>) => {
  // Ensure the user is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {adDetails} = request.data; // Access data from request.data for callable functions

  // Log the client-side completion notification
  logger.info(`Rewarded ad completed client-side for user ${userId}. Details: ${JSON.stringify(adDetails)}`);

  // TODO: Implement logic here to potentially correlate with the S2S postback
  // in adCallbacks.ts and trigger the coin award if the postback has been validated.
  // For now, this function primarily serves as a notification mechanism.

  return {success: true, message: "Rewarded ad completion notification received."};
});
