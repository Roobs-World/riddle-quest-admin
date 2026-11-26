import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {admin} from "../shared/firebaseAdmin";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";

const requestSchema = z.object({}).strict();
const profileFields = ["username", "coins", "stats", "progress", "unlockedAchievements", "avatarUrl",
  "hasPurchasedApp", "notificationsEnabled"];

/** Keeps browser profile reads inside the encrypted, authenticated game API. */
export const getPlayerProfile = onCallWithSentry("getPlayerProfile", browserCallableSecurityOptions, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  validateCallableRequest(requestSchema, request.data, "getPlayerProfile");
  const snapshot = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (!snapshot.exists) return null;
  const profile = snapshot.data() ?? {};
  return Object.fromEntries(profileFields.filter(field => profile[field] !== undefined).map(field => [field, profile[field]]));
});
