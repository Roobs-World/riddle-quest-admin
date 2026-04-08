import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {captureException} from "./sentry";

let dbInstance: admin.firestore.Firestore;
function getDb(): admin.firestore.Firestore {
  if (!dbInstance) dbInstance = admin.firestore();
  return dbInstance;
}

interface NotificationCampaign {
  id: string;
  name: string;
  title: string;
  body: string;
  templateId?: string;
  targetAudience: {
    type: "all" | "specific_users";
    userIds?: string[];
    minCoins?: number;
    maxDaysSinceLogin?: number;
  };
  status: "draft" | "sending" | "sent" | "failed";
  createdBy: string;
  createdAt: admin.firestore.Timestamp | {_seconds: number; _nanoseconds: number};
  sentAt?: admin.firestore.Timestamp;
  results?: {
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    successRate: number;
    errors: string[];
  };
}

/**
 * Queries users who should receive a campaign notification based on audience config.
 * Returns an array of {userId, fcmToken} pairs.
 */
async function getTargetedUsers(
  audience: NotificationCampaign["targetAudience"],
): Promise<Array<{userId: string; fcmToken: string}>> {
  let query: admin.firestore.Query = getDb().collection("users");

  if (audience.type === "specific_users" && audience.userIds?.length) {
    const chunks: Array<{userId: string; fcmToken: string}> = [];
    for (let i = 0; i < audience.userIds.length; i += 10) {
      const batch = audience.userIds.slice(i, i + 10);
      const snapshot = await getDb()
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      for (const doc of snapshot.docs) {
        const token = doc.data().fcmToken;
        if (token) chunks.push({userId: doc.id, fcmToken: token});
      }
    }
    return chunks;
  }

  if (audience.minCoins !== undefined) {
    query = query.where("coins", ">=", audience.minCoins);
  }

  if (audience.maxDaysSinceLogin !== undefined) {
    const cutoff = Date.now() - audience.maxDaysSinceLogin * 24 * 60 * 60 * 1000;
    query = query.where("lastLogin", ">=", cutoff);
  }

  const snapshot = await query.get();
  const results: Array<{userId: string; fcmToken: string}> = [];
  for (const doc of snapshot.docs) {
    const token = doc.data().fcmToken;
    if (token) results.push({userId: doc.id, fcmToken: token});
  }
  return results;
}

/**
 * Callable function: send a notification campaign by campaignId.
 * Reads the campaign document, sends FCM messages to targeted users,
 * and records results in notificationHistory.
 *
 * Must be called by an authenticated admin user (createdBy check is enforced).
 */
export const sendNotificationCampaign = onCall(
  async (request: functions.https.CallableRequest<{campaignId: string}>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {campaignId} = request.data;
    if (!campaignId || typeof campaignId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "campaignId is required.");
    }

    const campaignRef = getDb().collection("notificationCampaigns").doc(campaignId);
    const campaignDoc = await campaignRef.get();
    if (!campaignDoc.exists) {
      throw new functions.https.HttpsError("not-found", `Campaign ${campaignId} not found.`);
    }

    const campaign = campaignDoc.data() as NotificationCampaign;

    if (campaign.status === "sending" || campaign.status === "sent") {
      throw new functions.https.HttpsError("failed-precondition", `Campaign is already ${campaign.status}.`);
    }

    // Mark as sending
    await campaignRef.update({status: "sending"});

    const errors: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    try {
      const targetedUsers = await getTargetedUsers(campaign.targetAudience);
      const totalTargeted = targetedUsers.length;

      if (totalTargeted === 0) {
        errors.push("No users match the target criteria");
        await campaignRef.update({
          status: "failed",
          results: {totalTargeted: 0, totalSent: 0, totalFailed: 0, successRate: 0, errors},
        });
        return {success: false, message: "No users match the target criteria"};
      }

      functions.logger.info(
        `Sending campaign "${campaign.name}" to ${totalTargeted} users`,
      );

      const historyBatch = getDb().batch();
      const messaging = admin.messaging();

      // Send in chunks of 500 (FCM limit per multicast is 500)
      const chunkSize = 500;
      for (let i = 0; i < targetedUsers.length; i += chunkSize) {
        const chunk = targetedUsers.slice(i, i + chunkSize);
        const tokens = chunk.map((u) => u.fcmToken);

        try {
          const response = await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title: campaign.title,
              body: campaign.body,
            },
            data: {
              campaignId,
            },
          });

          const sentAt = admin.firestore.FieldValue.serverTimestamp();
          response.responses.forEach((res, idx) => {
            const {userId, fcmToken} = chunk[idx];
            const historyRef = getDb().collection("notificationHistory").doc();
            if (res.success) {
              totalSent++;
              historyBatch.set(historyRef, {
                id: historyRef.id,
                campaignId,
                userId,
                fcmToken,
                title: campaign.title,
                body: campaign.body,
                fcmMessageId: res.messageId,
                status: "sent",
                sentAt,
              });
            } else {
              totalFailed++;
              const errMsg = res.error?.message || "Unknown error";
              errors.push(`User ${userId}: ${errMsg}`);
              historyBatch.set(historyRef, {
                id: historyRef.id,
                campaignId,
                userId,
                fcmToken,
                title: campaign.title,
                body: campaign.body,
                status: "failed",
                error: errMsg,
                sentAt,
              });
            }
          });
        } catch (chunkErr) {
          const msg = chunkErr instanceof Error ? chunkErr.message : "Unknown error";
          functions.logger.error(`FCM chunk send failed:`, chunkErr);
          captureException(chunkErr);
          totalFailed += chunk.length;
          errors.push(`Chunk send error: ${msg}`);
        }
      }

      await historyBatch.commit();

      const successRate = totalSent / (totalSent + totalFailed);
      await campaignRef.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        results: {
          totalTargeted: targetedUsers.length,
          totalSent,
          totalFailed,
          successRate,
          errors,
        },
      });

      functions.logger.info(
        `Campaign "${campaign.name}" complete: ${totalSent} sent, ${totalFailed} failed`,
      );

      return {success: true, totalSent, totalFailed};
    } catch (err) {
      functions.logger.error(`Campaign send failed for ${campaignId}:`, err);
      captureException(err);
      await campaignRef.update({
        status: "failed",
        results: {
          totalTargeted: 0,
          totalSent,
          totalFailed,
          successRate: 0,
          errors: [...errors, err instanceof Error ? err.message : "Unexpected error"],
        },
      });
      throw new functions.https.HttpsError("internal", "Campaign send failed.");
    }
  },
);

/**
 * Callable function: register an FCM token for the authenticated user.
 */
export const registerFcmToken = onCall(
  async (request: functions.https.CallableRequest<{fcmToken: string}>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {fcmToken} = request.data;
    if (!fcmToken || typeof fcmToken !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "fcmToken is required.");
    }

    const userId = request.auth.uid;
    await getDb().collection("users").doc(userId).update({
      fcmToken,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`FCM token registered for user ${userId}`);
    return {success: true};
  },
);
