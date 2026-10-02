import {randomUUID} from "node:crypto";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {updateUserProfile} from "../gameplay/firestoreService";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {admin} from "../shared/firebaseAdmin";
import {captureException} from "../shared/sentry";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {UpdateAvatarRequestSchema, UpdateAvatarResponseSchema} from "@qwordly/core/validation/requestSchemas";
import {avatarDownloadUrl, decodeAvatarDataUrl} from "./avatarUpload";
import {syncLeaderboardProfileFields} from "./leaderboardProfile";
import {onCallWithSentry} from "../shared/sentryHandlers";

/** Uploads an authenticated registered player's avatar and updates its public URL. */
export const updateAvatar = onCallWithSentry(
  "updateAvatar",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (request.auth.token.jestRegistered !== true) {
      throw new HttpsError("failed-precondition", "Register with Jest before uploading a profile photo.");
    }

    /** Provides {image data url} behavior. */
    const {imageDataUrl} = validateCallableRequest(UpdateAvatarRequestSchema, request.data, "updateAvatar");
    /** Provides r id. */
    const userId = request.auth.uid;
    try {
      /** Provides {bytes, content type} behavior. */
      const {bytes, contentType} = decodeAvatarDataUrl(imageDataUrl);
      /** Provides bucket behavior. */
      const bucket = admin.storage().bucket();
      /** Provides object path behavior. */
      const objectPath = `avatars/${userId}/profile`;
      /** Provides file behavior. */
      const file = bucket.file(objectPath);
      /** Provides version behavior. */
      const version = Date.now();
      /** Provides download token behavior. */
      const downloadToken = randomUUID();
      await file.save(bytes, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: "public,max-age=86400",
          metadata: {
            uploadedAt: String(version),
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      });
      /** Provides avatar url behavior. */
      const avatarUrl = avatarDownloadUrl(bucket.name, objectPath, downloadToken);
      await updateUserProfile(userId, {avatarUrl});
      await syncLeaderboardProfileFields(userId, {avatarUrl});
      return validateCallableResponse(
        UpdateAvatarResponseSchema,
        {success: true, message: "Avatar updated successfully.", avatarUrl},
        "updateAvatar",
      );
    } catch (error) {
      logger.error(`Error updating avatar for user ${userId}:`, error);
      captureException(error);
      if (error instanceof HttpsError) throw error;
      /** Provides reason behavior. */
      const reason = error instanceof Error ? error.message : "";
      if (reason.startsWith("invalid-avatar-")) {
        throw new HttpsError("invalid-argument", "The selected image is invalid.");
      }
      throw new HttpsError("internal", "An error occurred while updating the avatar.");
    }
  },
);
