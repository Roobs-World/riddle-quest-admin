import {logger} from "../utils/logger";
import {getFirebaseApp} from "./firebaseApp";
import type {AppCheck, ReactNativeFirebaseAppCheckProvider} from "@react-native-firebase/app-check";

export type FirebaseAppCheckInitOptions = {
  debugToken?: string | null;
  isDevelopmentBuild?: boolean;
};

let appCheckInitializationPromise: Promise<void> | null = null;

const isAppCheckUnavailableError = (error: unknown): boolean => {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack ?? ""}`
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  const lowered = text.toLowerCase();
  return (
    lowered.includes("appcheck") ||
    lowered.includes("app-check") ||
    lowered.includes("app check") ||
    lowered.includes("initializeappcheck") ||
    lowered.includes("newreactnativefirebaseappcheckprovider") ||
    lowered.includes("module not found") ||
    lowered.includes("native module")
  );
};

const getAppCheckClient = (): AppCheck | null => {
  try {
    const app = getFirebaseApp();
    if (typeof app.appCheck !== "function") {
      return null;
    }
    return app.appCheck();
  } catch (error) {
    if (isAppCheckUnavailableError(error)) {
      return null;
    }
    throw error;
  }
};

const createFirebaseAppCheckProviderForClient = (
  appCheckClient: AppCheck,
  {
    debugToken,
    isDevelopmentBuild = __DEV__,
  }: FirebaseAppCheckInitOptions = {},
): ReactNativeFirebaseAppCheckProvider => {
  const provider = appCheckClient.newReactNativeFirebaseAppCheckProvider();
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

export const createFirebaseAppCheckProvider = ({
  debugToken,
  isDevelopmentBuild = __DEV__,
}: FirebaseAppCheckInitOptions = {}): ReactNativeFirebaseAppCheckProvider | null => {
  const appCheckClient = getAppCheckClient();
  if (!appCheckClient) {
    return null;
  }

  return createFirebaseAppCheckProviderForClient(appCheckClient, {
    debugToken,
    isDevelopmentBuild,
  });
};

export const initializeFirebaseAppCheck = async (
  options: FirebaseAppCheckInitOptions = {},
): Promise<void> => {
  if (!appCheckInitializationPromise) {
    appCheckInitializationPromise = (async () => {
      const appCheckClient = getAppCheckClient();
      if (!appCheckClient) {
        logger.debug("Firebase App Check is unavailable in this runtime; skipping initialization.");
        return;
      }
      const provider = createFirebaseAppCheckProviderForClient(appCheckClient, options);
      await appCheckClient.initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      logger.info("Firebase App Check initialized");
    })().catch((error: unknown) => {
      appCheckInitializationPromise = null;
      if (isAppCheckUnavailableError(error)) {
        logger.debug("Firebase App Check initialization skipped because the native module is unavailable.");
        return;
      }
      throw error;
    });
  }

  return appCheckInitializationPromise;
};

export const resetFirebaseAppCheckForTests = (): void => {
  appCheckInitializationPromise = null;
};
