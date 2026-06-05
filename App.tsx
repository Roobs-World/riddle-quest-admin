/**
 * @fileoverview Main application component for Riddle Quest - a riddle-based Wordle clone.
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
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import "./global.css";
import * as Sentry from "@sentry/react-native";
import {captureException} from "./src/utils/sentry";
import {logger} from "./src/utils/logger";

import React, {useCallback, useEffect, useRef, useState} from "react";
import {NavigationContainer} from "@react-navigation/native";
import {StyleSheet, Text, View} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {loadFonts} from "./src/utils/fontLoader";
import {SoundManager} from "./src/services/SoundManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {Settings} from "react-native-fbsdk-next";
import {GoogleSignin} from "@react-native-google-signin/google-signin";
import {AuthProvider} from "./src/contexts/AuthContext";
import {TooltipProvider} from "./src/contexts/TooltipContext";
import {Navigation} from "./src/navigation/NavigationStack";
import LanguageSelectionScreen from "./src/screens/LanguageSelectionScreen";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import {SolarSystemPreloader} from "./src/services/SolarSystemPreloader";
import {preloadShopCatalog} from "./src/services/ShopCatalogPreloader";
import {initializeRewardedAds} from "./src/services/RewardedAdService";
import {getCrashlytics, log as logCrashlyticsMessage} from "@react-native-firebase/crashlytics";
import {ModalProvider} from "./src/contexts/ModalContext";
import {QASurfaceGate} from "./src/qa/QASurfaceHarness";
import {
  LOCALE_STORAGE_KEY,
  isSupportedLanguage,
  setLocale,
  detectDeviceLanguage,
  t,
} from "./src/i18n";
import {isSharedAnimationBackendEnabled, isSharedAnimationBackendFlagRequested} from "./src/config/featureFlags";
import {SOUND_ENABLED_STORAGE_KEY, readBooleanSetting} from "./src/utils/settingsStorage";
import {initializeFirebaseAppCheck} from "./src/services/AppCheckService";

const SOLAR_PRELOAD_TIMEOUT_MS = 60000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  if (!googleWebClientId || googleWebClientId === "YOUR_GOOGLE_WEB_CLIENT_ID") {
    logger.warn("Google Web Client ID not configured. Google Sign-In may not work.");
  }

  GoogleSignin.configure({
    webClientId: googleWebClientId,
    offlineAccess: true,
    scopes: ["email", "profile"],
  });
};

const initializeFacebookSdkInBackground = async (): Promise<void> => {
  const facebookAppId = Constants.expoConfig?.extra?.FACEBOOK_APP_ID;
  const facebookClientToken = Constants.expoConfig?.extra?.FACEBOOK_CLIENT_TOKEN;

  if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID") {
    logger.warn("Facebook App ID not configured. Facebook features disabled.");
    return;
  }

  Settings.setAppID(facebookAppId);
  if (facebookClientToken && facebookClientToken !== "YOUR_FACEBOOK_CLIENT_TOKEN") {
    Settings.setClientToken(facebookClientToken);
  }
  Settings.initializeSDK();
};

const initializeFirebaseAppCheckInBackground = async (): Promise<void> => {
  const debugToken = Constants.expoConfig?.extra?.FIREBASE_APP_CHECK_DEBUG_TOKEN;
  await initializeFirebaseAppCheck({
    debugToken: typeof debugToken === "string" && debugToken.length > 0 ? debugToken : undefined,
  });
};

const FatalStartupScreen = (): React.JSX.Element => {
  return (
    <View style={styles.fatalContainer}>
      <Text style={styles.fatalTitle}>{t("ErrorMessages.FATAL_STARTUP_TITLE")}</Text>
      <Text style={styles.fatalMessage}>{t("ErrorMessages.FATAL_STARTUP_MESSAGE")}</Text>
    </View>
  );
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
  const [requiresInitialLanguageSelection, setRequiresInitialLanguageSelection] = useState(false);
  const [startupError, setStartupError] = useState<unknown | null>(null);
  const hasStartedCriticalInitRef = useRef(false);
  const hasStartedBackgroundInitRef = useRef(false);

  const startBackgroundInitialization = useCallback(() => {
    if (hasStartedBackgroundInitRef.current) {
      return;
    }
    hasStartedBackgroundInitRef.current = true;

    void (async () => {
      const tasks = [
        initializeFirebaseAppCheckInBackground(),
        initializeSoundInBackground(),
        preloadShopCatalog(),
        initializeRewardedAds(),
        initializeFacebookSdkInBackground(),
      ];

      const results = await Promise.allSettled(tasks);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.warn(`Background startup task ${index + 1} failed`, result.reason);
          captureException(result.reason, {context: "App.backgroundInit"});
        }
      });
    })();
  }, []);

  useEffect(() => {
    if (hasStartedCriticalInitRef.current) {
      return;
    }

    hasStartedCriticalInitRef.current = true;
    startBackgroundInitialization();
    let isMounted = true;

    void (async () => {
      try {
        logger.info("Starting app initialization");
        if (isSharedAnimationBackendEnabled()) {
          logger.info("Shared Animation Backend is active (RN 0.85.1+ requirement satisfied).");
        } else if (isSharedAnimationBackendFlagRequested()) {
          logger.warn(
            "Shared Animation Backend flag requested but current RN version does not satisfy 0.85.1+ requirement.",
          );
        }
        logCrashlyticsMessage(getCrashlytics(), "App initialization started");
        const savedLanguage = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (savedLanguage && isSupportedLanguage(savedLanguage)) {
          setLocale(savedLanguage);
          if (isMounted) {
            setRequiresInitialLanguageSelection(false);
          }
        } else {
          detectDeviceLanguage();
          if (isMounted) {
            setRequiresInitialLanguageSelection(true);
          }
        }
        try {
          await withTimeout(SolarSystemPreloader.preloadSolarSystem(), SOLAR_PRELOAD_TIMEOUT_MS);
        } catch (error) {
          logger.error("Fatal solar startup error:", error);
          captureException(error, {context: "App.solarStartup"});
          if (isMounted) {
            setStartupError(error);
          }
          return;
        }
        await loadFonts();
        configureGoogleSignIn();
      } catch (error: unknown) {
        logger.error("Critical app initialization error:", error);
        captureException(error, {context: "App.criticalInit"});
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [startBackgroundInitialization]);

  if (startupError) {
    return <FatalStartupScreen />;
  }

  if (!isInitialized) {
    return <PulsingSpinner visible={true} size={120} opacity={0.8} />;
  }

  const handleCompleteInitialLanguageSelection = async (language: Parameters<typeof setLocale>[0]): Promise<void> => {
    setLocale(language);

    try {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, language);
    } catch (error) {
      logger.error("Failed to persist initial language selection:", error);
      captureException(error, {context: "App.persistInitialLanguageSelection"});
    } finally {
      setRequiresInitialLanguageSelection(false);
    }
  };

  return (
    <Sentry.ErrorBoundary
      fallback={<PulsingSpinner visible={true} size={120} opacity={0.8} />}
      onError={(error) => captureException(error, {context: "App.ErrorBoundary"})}
    >
      <SafeAreaProvider>
        <ModalProvider>
          <AuthProvider>
            <TooltipProvider>
              <View style={{flex: 1}}>
                {requiresInitialLanguageSelection ? (
                  <LanguageSelectionScreen onSubmit={handleCompleteInitialLanguageSelection} />
                ) : (
                  <QASurfaceGate>
                    <NavigationContainer>
                      <Navigation />
                    </NavigationContainer>
                  </QASurfaceGate>
                )}
              </View>
            </TooltipProvider>
          </AuthProvider>
        </ModalProvider>
      </SafeAreaProvider>
    </Sentry.ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  fatalContainer: {
    alignItems: "center",
    backgroundColor: "#0b1020",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fatalTitle: {
    color: "#fff7e6",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  fatalMessage: {
    color: "#d6d9e8",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
    textAlign: "center",
  },
});
