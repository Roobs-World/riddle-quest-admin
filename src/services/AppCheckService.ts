import {logger} from "../utils/logger";
import {getFirebaseApp} from "./firebaseApp";
import type {AppCheck, ReactNativeFirebaseAppCheckProvider} from "@react-native-firebase/app-check";

export type FirebaseAppCheckInitOptions = {
  debugToken?: string | null;
  isDevelopmentBuild?: boolean;
};

let appCheckInitializationPromise: Promise<void> | null = null;

const getAppCheckClient = (): AppCheck => getFirebaseApp().appCheck();

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
}: FirebaseAppCheckInitOptions = {}): ReactNativeFirebaseAppCheckProvider =>
  createFirebaseAppCheckProviderForClient(getAppCheckClient(), {
    debugToken,
    isDevelopmentBuild,
  });

export const initializeFirebaseAppCheck = async (
  options: FirebaseAppCheckInitOptions = {},
): Promise<void> => {
  if (!appCheckInitializationPromise) {
    appCheckInitializationPromise = (async () => {
      const appCheckClient = getAppCheckClient();
      const provider = createFirebaseAppCheckProviderForClient(appCheckClient, options);
      await appCheckClient.initializeAppCheck({
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
