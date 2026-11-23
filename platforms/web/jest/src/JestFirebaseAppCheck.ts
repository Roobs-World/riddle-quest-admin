import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from "firebase/app-check";
import {firebaseApp} from "../../../../packages/web-game/src/firebase";
import {firebaseEnvironment} from "../../../../packages/web-game/src/firebaseEnvironment";
import {hasTrustedTestHarnessMarker} from "../../../../packages/web-game/src/testHarness";

/** Indicates whether a trusted harness route may bypass browser attestation. */
const isHarnessRoute =
  typeof window !== "undefined" &&
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
  await attest(appCheck);
}

/** First successful attestation, shared by the startup warm-up and the authenticated gate. */
let attestation: Promise<void> | null = null;

/** Attests once; a failed attempt is forgotten so the next caller retries. */
function attest(instance: AppCheck): Promise<void> {
  attestation ??= getToken(instance).then(() => {
    setTokenAutoRefreshEnabled(instance, true);
  }, (error: unknown) => {
    attestation = null;
    throw error;
  });
  return attestation;
}

/**
 * Starts attestation while the Jest SDK and identity exchange are still in flight.
 *
 * reCAPTCHA Enterprise must download its script and score the session before
 * Firebase issues a token, which otherwise happens only after identity exchange
 * and sign-in. Failures are left for {@link ensureJestFirebaseAppCheckReady} to
 * surface and retry on the authenticated startup path.
 */
export function warmJestFirebaseAppCheck(): void {
  if (appCheck) attest(appCheck).catch(() => undefined);
}
