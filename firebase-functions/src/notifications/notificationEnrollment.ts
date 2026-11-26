import {HttpsError, onCall} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";

const options = {...browserCallableSecurityOptions, region: "europe-west1", secrets: []};

/** Older games may still ask for a browser pairing link. */
export const createNotificationEnrollment = onCall(options, () => {
  throw new HttpsError("failed-precondition", "Browser push enrollment has ended.");
});

/** Older games may still check the completion of a browser pairing. */
export const getNotificationEnrollmentStatus = onCall(options, request => {
  if (!request.auth) throw new HttpsError("permission-denied", "Registered game account required.");
  return {registeredDevices: 0, enrollmentComplete: false};
});
