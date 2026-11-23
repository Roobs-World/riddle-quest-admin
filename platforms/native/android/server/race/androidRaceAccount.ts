import {HttpsError} from "firebase-functions/v2/https";
import {isAndroidAccountProvider} from "../androidUser";
import {raceProviderScope} from "../../../../../firebase-functions/src/race/access/raceProviderScope";

/** Rejects an unprovisioned Firebase identity before it can create an Android race seat. */
export function assertAndroidRaceAccount(userId: string, profile: FirebaseFirestore.DocumentData | undefined): void {
  if (raceProviderScope(userId) === "android" && !isAndroidAccountProvider(profile?.androidProvider)) {
    throw new HttpsError("permission-denied", "Android game account required.");
  }
}
