import {getFunctions} from "firebase/functions";
import {encryptedHttpsCallable} from "../../../../../src/platform/firebase/encryptedCallable";
import {JestNotificationPlan} from "./managerProtocol";

/** Fetches only a server-authorized plan; campaign content never originates in gameplay. */
export async function getJestNotificationPlan(): Promise<JestNotificationPlan> {
  const {firebaseApp} = await import("../../../../../src/platform/firebase/browserClient");
  const callable = encryptedHttpsCallable<Record<string, never>, unknown>(
    getFunctions(firebaseApp, "europe-west1"), "getJestNotificationPlan",
  );
  const response = await callable({});
  return JestNotificationPlan.parse(response.data);
}
