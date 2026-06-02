import {logger} from "../utils/logger";
import * as appCheckNamespace from "@react-native-firebase/app-check";
import {getFirebaseApp} from "./firebaseApp";
import type {ReactNativeFirebaseAppCheckProvider} from "@react-native-firebase/app-check";

export type FirebaseAppCheckInitOptions = {
  debugToken?: string | null;
  isDevelopmentBuild?: boolean;
};

let appCheckInitializationPromise: Promise<void> | null = null;

type FirebaseAppCheckClient = {
  initializeAppCheck: (options: {
    provider: ReactNativeFirebaseAppCheckProvider;
    isTokenAutoRefreshEnabled: boolean;
  }) => Promise<void>;
};

const hasInitializeAppCheck = (value: unknown): value is FirebaseAppCheckClient =>
  value != null &&
  typeof value === "object" &&
  "initializeAppCheck" in value &&
  typeof (value as FirebaseAppCheckClient).initializeAppCheck === "function";

const resolveAppCheckClient = (): FirebaseAppCheckClient => {
  if (hasInitializeAppCheck(appCheckNamespace)) {
    return appCheckNamespace;
  }

  const defaultExport = (appCheckNamespace as {default?: unknown}).default;
  if (hasInitializeAppCheck(defaultExport)) {
    return defaultExport;
  }

  if (typeof defaultExport === "function") {
    const resolved = defaultExport();
    if (hasInitializeAppCheck(resolved)) {
      return resolved;
    }
  }

  throw new TypeError("Firebase App Check namespace is not callable.");
};

export const createFirebaseAppCheckProvider = ({
  debugToken,
  isDevelopmentBuild = __DEV__,
}: FirebaseAppCheckInitOptions = {}): ReactNativeFirebaseAppCheckProvider => {
  const provider = getFirebaseApp().appCheck().newReactNativeFirebaseAppCheckProvider();
  const isDebugBuild = Boolean(isDevelopmentBuild);

  provider.configure({
    android: {
      provider: isDebugBuild ? "debug" : "playIntegrity",
      ...(debugToken ? {debugToken} : {}),
    },
    apple: {
      provider: isDebugBuild ? "debug" : "appAttestWithDeviceCheckFallback",
      ...(debugToken ? {debugToken} : {}),
    },
  });

  return provider;
};

export const initializeFirebaseAppCheck = async (
  options: FirebaseAppCheckInitOptions = {},
): Promise<void> => {
  if (!appCheckInitializationPromise) {
    appCheckInitializationPromise = (async () => {
      const provider = createFirebaseAppCheckProvider(options);
      await resolveAppCheckClient().initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      logger.info("Firebase App Check initialized");
    })().catch((error: unknown) => {
      appCheckInitializationPromise = null;
      throw error;
    });
  }

  return appCheckInitializationPromise;
};

export const resetFirebaseAppCheckForTests = (): void => {
  appCheckInitializationPromise = null;
};
