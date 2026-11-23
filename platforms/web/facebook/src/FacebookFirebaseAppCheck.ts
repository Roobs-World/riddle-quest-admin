import {
  CustomProvider,
  getToken,
  initializeAppCheck,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from "firebase/app-check";
import {firebaseApp} from "../../../../src/web/firebase";
import {firebaseEnvironment} from "../../../../src/web/firebaseEnvironment";

/** Facebook-owned custom attestation instance. */
let appCheck: AppCheck | null = null;
/** Renewable token callback installed by the current Facebook account generation. */
let facebookAppCheckTokenProvider:
  | (() => Promise<{
      /** Stores token. */
      token: string; /** Stores expire time millis. */
      /** Stores expire time millis. */
      expireTimeMillis: number;
    }>)
  | null = null;

/** Installs the Facebook custom attestation adapter before protected calls begin. */
export async function initializeFacebookAppCheck(
  getCustomToken: () => Promise<{
    /** Stores token. */
    token: string; /** Stores expire time millis. */
    /** Stores expire time millis. */
    expireTimeMillis: number;
  }>,
): Promise<void> {
  if (firebaseEnvironment.platformTarget !== "facebook") {
    throw new Error("Facebook App Check can only initialize in the Facebook Web Target.");
  }
  facebookAppCheckTokenProvider = getCustomToken;
  if (!appCheck) {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new CustomProvider({
        getToken: async () => {
          if (!facebookAppCheckTokenProvider) {
            throw new Error("Facebook App Check token provider is unavailable.");
          }
          return facebookAppCheckTokenProvider();
        },
      }),
      isTokenAutoRefreshEnabled: false,
    });
  }
  // Reauthentication may follow account deletion and generation rollover. Force
  // attestation so a cached token from the prior Firebase account is never reused.
  await getToken(appCheck, true);
  setTokenAutoRefreshEnabled(appCheck, true);
}
