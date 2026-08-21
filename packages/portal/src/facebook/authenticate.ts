import type {FacebookInstantSdk} from "./fbinstant";
import type {FacebookBackendPort, FacebookIdentityCredentials} from "./backend";
import {exchangeFacebookCredentials} from "./credentialExchange";

/** Describes app check token. */
type AppCheckToken = {/** Stores token. */
/** Stores token. */
token: string; /** Stores expire time millis. */
/** Stores expire time millis. */
expireTimeMillis: number};

/** Defines the contract for facebook firebase auth runtime. */
export interface FacebookFirebaseAuthRuntime {
  /** Provides initialize app check behavior. */
  initializeAppCheck(getToken: () => Promise<AppCheckToken>): Promise<void>;
  /** Provides sign in behavior. */
  signIn(customToken: string): Promise<void>;
}

/** Provides default firebase runtime behavior. */
const defaultFirebaseRuntime = async (): Promise<FacebookFirebaseAuthRuntime> => {
  const firebase = await import("../firebase");
  const {signInWithCustomToken} = await import("firebase/auth");
  return {
    initializeAppCheck: (getToken) => firebase.initializeFacebookAppCheck(getToken),
    signIn: async (customToken) => {
      await signInWithCustomToken(firebase.auth, customToken);
    },
  };
};

/** Authenticates Firebase and installs renewable custom App Check attestation. */
export async function authenticateFacebook(
  sdk: FacebookInstantSdk,
  backend?: FacebookBackendPort,
  runtime?: FacebookFirebaseAuthRuntime,
): Promise<string> {
  const resolvedBackend = backend ?? (await import("./defaultBackend")).createDefaultFacebookBackend();
  const initialCredentials = await exchangeFacebookCredentials(sdk, resolvedBackend);
  let nextAppCheckCredentials: FacebookIdentityCredentials | undefined = initialCredentials;
  let refreshCredentials: Promise<FacebookIdentityCredentials> | undefined;
  const firebaseRuntime = runtime ?? await defaultFirebaseRuntime();
  await firebaseRuntime.initializeAppCheck(async () => {
    let credentials = nextAppCheckCredentials;
    if (credentials) {
      nextAppCheckCredentials = undefined;
    } else {
      const pending = refreshCredentials ??= exchangeFacebookCredentials(sdk, resolvedBackend);
      try {
        credentials = await pending;
      } finally {
        if (refreshCredentials === pending) refreshCredentials = undefined;
      }
    }
    if (credentials.uid !== initialCredentials.uid) {
      throw new Error("facebook-account-generation-changed");
    }
    const issuedAtMs = Date.now();
    if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0 ||
      issuedAtMs > Number.MAX_SAFE_INTEGER - credentials.appCheckExpiresInMs) {
      throw new Error("facebook-app-check-expiry-invalid");
    }
    return {
      token: credentials.appCheckToken,
      expireTimeMillis: issuedAtMs + credentials.appCheckExpiresInMs,
    };
  });
  await firebaseRuntime.signIn(initialCredentials.customToken);
  return initialCredentials.uid;
}
