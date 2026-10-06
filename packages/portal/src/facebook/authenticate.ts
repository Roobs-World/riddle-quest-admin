import type {FacebookInstantSdk} from "./fbinstant";
import type {FacebookBackendPort, FacebookIdentityCredentials} from "./backend";
import {exchangeFacebookCredentials} from "./credentialExchange";

/** Describes app check token. */
type AppCheckToken = {
  /** Stores token. */
  /** Stores token. */
  token: string; /** Stores expire time millis. */
  /** Stores expire time millis. */
  expireTimeMillis: number;
};

/** Defines the contract for facebook firebase auth runtime. */
export interface FacebookFirebaseAuthRuntime {
  /** Provides initialize app check behavior. */
  initializeAppCheck(getToken: () => Promise<AppCheckToken>): Promise<void>;
  /** Provides sign in behavior. */
  signIn(customToken: string): Promise<void>;
}

/** Provides default firebase runtime behavior. */
const defaultFirebaseRuntime = async (): Promise<FacebookFirebaseAuthRuntime> => {
  /** Provides [firebase, {initialize facebook app check}, {sign in with custom token}] behavior. */
  const [firebase, {initializeFacebookAppCheck}, {signInWithCustomToken}] = await Promise.all([
    import("../firebase"),
    import("./FacebookFirebaseAppCheck"),
    import("firebase/auth"),
  ]);
  return {
    initializeAppCheck: (getToken) => initializeFacebookAppCheck(getToken),
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
  /** Firebase SDK chunks download while the identity exchange is in flight. */
  const firebaseRuntimeLoad = runtime ? Promise.resolve(runtime) : defaultFirebaseRuntime();
  // A failed exchange must not surface the parallel load as an unhandled rejection.
  firebaseRuntimeLoad.catch(() => undefined);
  /** Resolves d backend. */
  const resolvedBackend = backend ?? (await import("./defaultBackend")).createDefaultFacebookBackend();
  /** Provides initial credentials behavior. */
  const initialCredentials = await exchangeFacebookCredentials(sdk, resolvedBackend);
  /** Provides next app check credentials behavior. */
  let nextAppCheckCredentials: FacebookIdentityCredentials | undefined = initialCredentials;
  /** Provides refresh credentials behavior. */
  let refreshCredentials: Promise<FacebookIdentityCredentials> | undefined;
  /** Provides firebase runtime behavior. */
  const firebaseRuntime = await firebaseRuntimeLoad;
  await firebaseRuntime.initializeAppCheck(async () => {
    /** Provides credentials behavior. */
    let credentials = nextAppCheckCredentials;
    if (credentials) {
      nextAppCheckCredentials = undefined;
    } else {
      /** Provides pending behavior. */
      const pending = (refreshCredentials ??= exchangeFacebookCredentials(sdk, resolvedBackend));
      try {
        credentials = await pending;
      } finally {
        if (refreshCredentials === pending) refreshCredentials = undefined;
      }
    }
    if (credentials.uid !== initialCredentials.uid) {
      throw new Error("facebook-account-generation-changed");
    }
    /** Provides issued at ms behavior. */
    const issuedAtMs = Date.now();
    if (
      !Number.isSafeInteger(issuedAtMs) ||
      issuedAtMs < 0 ||
      issuedAtMs > Number.MAX_SAFE_INTEGER - credentials.appCheckExpiresInMs
    ) {
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
