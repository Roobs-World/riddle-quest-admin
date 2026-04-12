/**
 * @fileoverview Main application component for Qwordly - a riddle-based Wordle clone.
 *
 * This file serves as the entry point for the React Native application, responsible for:
 * - Initializing all core services (Firebase, auth providers, ads, 3D system)
 * - Loading fonts and audio resources
 * - Setting up navigation and context providers
 * - Handling app-wide error states and loading screens
 *
 * The app follows a comprehensive initialization sequence to ensure all services
 * are properly configured before presenting the UI to users.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import "./global.css";
import * as Sentry from "@sentry/react-native";
import { captureException } from "./src/utils/sentry";
import { logger } from "./src/utils/logger";

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View } from "react-native";
import { loadFonts } from "./src/utils/fontLoader";
import { SoundManager } from "./src/services/SoundManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Settings } from "react-native-fbsdk-next";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AuthProvider } from "./src/contexts/AuthContext";
import { Navigation } from "./src/navigation/NavigationStack";
import AppLovinMAX, { Configuration } from "react-native-applovin-max";
import PulsingSpinner from "./src/components/loading/PulsingSpinner";
import { SolarSystemPreloader } from "./src/services/SolarSystemPreloader";
import { preloadShopCatalog } from "./src/services/ShopCatalogPreloader";
import { getCrashlytics } from "@react-native-firebase/crashlytics";
import { ModalProvider } from "./src/contexts/ModalContext";
import {
  APP_LANGUAGE_STORAGE_KEY,
  isSupportedLanguage,
  setAppLanguage,
  detectDeviceLanguage,
} from "./src/constants/AppStrings";
import {
  isSharedAnimationBackendEnabled,
  isSharedAnimationBackendFlagRequested,
} from "./src/config/featureFlags";
import {
  SOUND_ENABLED_STORAGE_KEY,
  readBooleanSetting,
} from "./src/utils/settingsStorage";

const SOLAR_PRELOAD_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    }),
  ]);
};

const initializeSoundInBackground = async (): Promise<void> => {
  await SoundManager.init();
  const soundEnabled = await readBooleanSetting(SOUND_ENABLED_STORAGE_KEY, true);
  SoundManager.setSoundEnabled(soundEnabled);
  if (soundEnabled) {
    await SoundManager.playBackgroundMusic();
  }
};

const configureGoogleSignIn = (): void => {
  const googleWebClientId = Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID;
  if (
    !googleWebClientId ||
    googleWebClientId === "YOUR_GOOGLE_WEB_CLIENT_ID"
  ) {
    logger.warn(
      "Google Web Client ID not configured. Google Sign-In may not work."
    );
  }

  GoogleSignin.configure({
    webClientId: googleWebClientId,
    offlineAccess: true,
    scopes: ["email", "profile"],
  });
};

const initializeAppLovinInBackground = async (): Promise<void> => {
  const applovinSdkKey = Constants.expoConfig?.extra?.APPLOVIN_SDK_KEY;
  if (!applovinSdkKey || applovinSdkKey === "YOUR_APPLOVIN_SDK_KEY") {
    logger.warn("AppLovin SDK key not configured. Ads will not initialize.");
    return;
  }
  const configuration: Configuration = await AppLovinMAX.initialize(
    applovinSdkKey
  );
  logger.debug("AppLovin initialized:", configuration);
};

const initializeFacebookSdkInBackground = async (): Promise<void> => {
  const facebookAppId = Constants.expoConfig?.extra?.FACEBOOK_APP_ID;
  const facebookClientToken = Constants.expoConfig?.extra?.FACEBOOK_CLIENT_TOKEN;

  if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID") {
    logger.warn("Facebook App ID not configured. Facebook features disabled.");
    return;
  }

  Settings.setAppID(facebookAppId);
  if (
    facebookClientToken &&
    facebookClientToken !== "YOUR_FACEBOOK_CLIENT_TOKEN"
  ) {
    Settings.setClientToken(facebookClientToken);
  }
  Settings.initializeSDK();
};

/**
 * Main application component that initializes all services and provides the core app structure.
 *
 * This component handles the complete application bootstrap process including:
 * - Service initialization (Firebase, auth, ads, 3D rendering)
 * - Resource loading (fonts, audio, 3D models)
 * - Error handling and graceful degradation
 * - Loading state management
 *
 * The app uses a phased initialization approach to ensure critical services
 * are available before non-essential features like 3D rendering.
 *
 * @returns {JSX.Element} The root application component with providers and navigation
 */
export default Sentry.wrap(function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const hasStartedCriticalInitRef = useRef(false);
  const hasStartedBackgroundInitRef = useRef(false);

  const startBackgroundInitialization = useCallback(() => {
    if (hasStartedBackgroundInitRef.current) {
      return;
    }
    hasStartedBackgroundInitRef.current = true;

    void (async () => {
      const tasks = [
        initializeSoundInBackground(),
        withTimeout(
          SolarSystemPreloader.preloadSolarSystem(),
          SOLAR_PRELOAD_TIMEOUT_MS
        ),
        preloadShopCatalog(),
        initializeAppLovinInBackground(),
        initializeFacebookSdkInBackground(),
      ];

      const results = await Promise.allSettled(tasks);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.warn(`Background startup task ${index + 1} failed`, result.reason);
          captureException(result.reason, { context: "App.backgroundInit" });
        }
      });
    })();
  }, []);

  useEffect(() => {
    if (hasStartedCriticalInitRef.current) {
      return;
    }

    hasStartedCriticalInitRef.current = true;
    let isMounted = true;

    void (async () => {
      try {
        logger.info("Starting app initialization");
        if (isSharedAnimationBackendEnabled()) {
          logger.info(
            "Shared Animation Backend is active (RN 0.85.1+ requirement satisfied)."
          );
        } else if (isSharedAnimationBackendFlagRequested()) {
          logger.warn(
            "Shared Animation Backend flag requested but current RN version does not satisfy 0.85.1+ requirement."
          );
        }
        getCrashlytics().log("App initialization started");
        const savedLanguage = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
        if (savedLanguage && isSupportedLanguage(savedLanguage)) {
          setAppLanguage(savedLanguage);
        } else {
          detectDeviceLanguage();
        }
        await loadFonts();
        configureGoogleSignIn();
      } catch (error: unknown) {
        logger.error("Critical app initialization error:", error);
        captureException(error, { context: "App.criticalInit" });
      } finally {
        if (isMounted) {
          setIsInitialized(true);
          startBackgroundInitialization();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [startBackgroundInitialization]);

  if (!isInitialized) {
    return <PulsingSpinner visible={true} size={120} opacity={0.8} />;
  }
  return (
    <Sentry.ErrorBoundary
      fallback={<PulsingSpinner visible={true} size={120} opacity={0.8} />}
      onError={(error) => captureException(error, { context: "App.ErrorBoundary" })}
    >
      <ModalProvider>
        <AuthProvider>
          <View style={{ flex: 1 }}>
            <NavigationContainer>
              <Navigation />
            </NavigationContainer>
          </View>
        </AuthProvider>
      </ModalProvider>
    </Sentry.ErrorBoundary>
  );
});
