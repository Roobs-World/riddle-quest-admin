import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from "firebase/app-check";
import {firebaseApp} from "../firebase";
import {firebaseEnvironment} from "../firebaseEnvironment";
import {hasTrustedTestHarnessMarker} from "../testHarness";

/** Indicates whether a trusted harness route may bypass browser attestation. */
const isHarnessRoute = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("harness") &&
  (!firebaseEnvironment.production || hasTrustedTestHarnessMarker());

/** Jest-owned reCAPTCHA Enterprise attestation instance. */
let appCheck: AppCheck | null = null;

if (firebaseEnvironment.platformTarget !== "jest") {
  throw new Error("Jest App Check can only initialize in the Jest Web Target.");
}

if (firebaseEnvironment.appCheckSiteKey && !isHarnessRoute) {
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(firebaseEnvironment.appCheckSiteKey),
    isTokenAutoRefreshEnabled: false,
  });
}

/**
 * Waits for Jest browser attestation before protected Firebase resources are used.
 *
 * Firebase Functions reject requests without App Check in production, so Jest
 * startup must not expose the playable game until an attestation token exists.
 */
export async function ensureJestFirebaseAppCheckReady(): Promise<void> {
  if (!appCheck) {
    if (firebaseEnvironment.production && firebaseEnvironment.jestRuntime === "1" && !isHarnessRoute) {
      throw new Error("Firebase App Check is not configured for the Jest build.");
    }
    return;
  }
  await getToken(appCheck);
  setTokenAutoRefreshEnabled(appCheck, true);
}
