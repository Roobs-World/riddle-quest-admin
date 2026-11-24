import {getFunctions, httpsCallable} from "firebase/functions";
import {firebaseEnvironment} from "../../platform/firebase/browserEnvironment";
import type {FirebaseEnrollmentBackend} from "./firebaseEnrollment";

async function enrollmentFunctions(expectedUid: string) {
  const {auth, firebaseApp} = await import("../../platform/firebase/browserClient");
  if (auth.currentUser?.uid !== expectedUid) throw new Error("notification-enrollment-account-changed");
  return getFunctions(firebaseApp, firebaseEnvironment.gameplayRegion || "europe-west1");
}

/** Provider-authenticated Firebase callables retain the signed-in UID and App Check token. */
export function createFirebaseEnrollmentBackend({expectedUid, isCurrent, run}: {
  expectedUid: string;
  isCurrent(): boolean;
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
}): FirebaseEnrollmentBackend {
  return {
    createEnrollment: input => run(async () => {
      const functions = await enrollmentFunctions(expectedUid);
      if (!isCurrent()) throw new Error("notification-enrollment-account-changed");
      const result = await httpsCallable<typeof input, unknown>(functions, "createNotificationEnrollment")(input);
      if (!isCurrent()) throw new Error("notification-enrollment-account-changed");
      return result.data;
    }),
    getEnrollmentStatus: input => run(async () => {
      const functions = await enrollmentFunctions(expectedUid);
      if (!isCurrent()) throw new Error("notification-enrollment-account-changed");
      const result = await httpsCallable<typeof input, unknown>(functions, "getNotificationEnrollmentStatus")(input);
      if (!isCurrent()) throw new Error("notification-enrollment-account-changed");
      return result.data;
    }),
  };
}
