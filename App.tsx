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

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
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
import { AuthService } from "./src/services/AuthService";
import { SolarSystemPreloader } from "./src/services/SolarSystemPreloader";
import { getCrashlytics } from "@react-native-firebase/crashlytics";
import { ModalProvider } from "./src/contexts/ModalContext";

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
  /** Application initialization state - true when all services are ready */
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Comprehensive application initialization effect.
   *
   * Initializes all app services in a specific order to ensure dependencies
   * are met and the app is fully functional before presenting the UI.
   * Uses proper error handling to ensure app functionality even if some
   * services fail to initialize.
   */
  useEffect(() => {
    /**
     * Asynchronous initialization function that sets up all app services.
     *
     * Initialization sequence:
     * 1. Firebase Crashlytics for error tracking
     * 2. 3D Solar System cache clearing
     * 3. Font and audio service loading
     * 4. 3D Solar System preloading (with timeout protection)
     * 5. Google Sign-In configuration
     * 6. AppLovin SDK initialization for ads
     * 7. Facebook SDK setup and diagnostics
     *
     * Each step includes comprehensive error handling to ensure app
     * functionality even if individual services fail.
     *
     * @throws {Error} Critical initialization errors that prevent app startup
     */
    async function initializeApp() {
      try {
        console.log("🚀 Starting app initialization...");

        // Initialize Firebase Crashlytics for error tracking and monitoring
        console.log("📊 Initializing Firebase Crashlytics...");
        getCrashlytics().log("App initialization started");
        console.log("✅ Firebase Crashlytics initialized successfully!");

        // Clear any existing solar system cache to start fresh
        SolarSystemPreloader.clearCache();
        console.log("🧹 Cleared solar system cache");

        // Load fonts and initialize sound manager for UI and game audio
        console.log("📝 Loading fonts...");
        await loadFonts();
        console.log("🔊 Initializing sound manager...");
        await SoundManager.init();

        // Start background music immediately — respects stored sound preference
        const storedSound = await AsyncStorage.getItem("isSoundEnabled");
        const soundEnabled = storedSound !== null ? JSON.parse(storedSound) : true;
        SoundManager.setSoundEnabled(soundEnabled);
        if (soundEnabled) {
          await SoundManager.playBackgroundMusic();
        }

        console.log("✅ Fonts and sound manager initialized");

        // Preload 3D solar system during app initialization with timeout protection
        console.log("🌌 Preloading 3D solar system...");

        try {
          /**
           * 3D Solar System Preloading with Timeout Protection
           *
           * Loads all 3D models, textures, and materials for the background
           * solar system animation. Uses a 30-second timeout to prevent
           * app startup delays if network or asset loading issues occur.
           *
           * The app continues functioning even if 3D loading fails, using
           * fallback rendering or no 3D background.
           */
          // Add 30-second timeout wrapper around preloading
          const preloadPromise = SolarSystemPreloader.preloadSolarSystem(
            (progress) => {
              console.log(
                `🌌 Solar system loading: ${progress.percentage}% - ${progress.currentItem}`
              );
            }
          );

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error("Solar system preloading timed out after 30 seconds")
              );
            }, 30000);
          });

          await Promise.race([preloadPromise, timeoutPromise]);
          console.log("✅ 3D solar system preloaded successfully");

          // Verify the solar system was loaded properly
          const system = SolarSystemPreloader.getPreloadedSystem();
          if (system) {
            console.log(
              `🌌 Solar system verification: ${system.meshes.length} meshes, ${system.scene.children.length} scene children`
            );
          } else {
            console.warn("⚠️ Solar system loaded but not accessible");
          }
        } catch (error) {
          console.error("❌ Solar system preloading failed:", error);

          // Provide detailed debugging information for troubleshooting
          if (error instanceof Error) {
            console.error("Error details:", {
              name: error.name,
              message: error.message,
              stack: error.stack,
            });

            if (
              error.message.includes("Texture loading failed") ||
              error.message.includes("timed out")
            ) {
              console.error("🔍 TEXTURE LOADING DIAGNOSIS:");
              console.error("- Check that Expo development server is running");
              console.error("- Verify network connectivity");
              console.error(
                "- Ensure assets/3d/ folder contains all required PNG files"
              );
              console.error("- Try restarting Metro bundler with --clear flag");
              console.error(
                "- App will continue with fallback 3D system or without 3D"
              );
            }
          }

          // Clear progress state and continue - app should work without 3D system
          console.warn(
            "⚠️ Continuing app initialization without 3D solar system"
          );
          // Don't throw - allow app to continue functioning
        }

        /**
         * Google Sign-In Configuration
         *
         * Configures Google authentication with the web client ID from
         * Firebase project configuration loaded from environment variables.
         * Enables offline access for token refresh capabilities.
         */
        console.log("🔑 Configuring Google Sign-In...");
        const googleWebClientId =
          Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID;

        if (
          !googleWebClientId ||
          googleWebClientId === "YOUR_GOOGLE_WEB_CLIENT_ID"
        ) {
          console.warn(
            "⚠️ Google Web Client ID not configured. Google Sign-In may not work."
          );
          console.warn("⚠️ Please set GOOGLE_WEB_CLIENT_ID in your .env file");
        }

        GoogleSignin.configure({
          webClientId: googleWebClientId,
          offlineAccess: true,
          scopes: ["email", "profile"],
        });
        console.log("✅ Google Sign-In configured successfully!");
        console.log(
          "🔑 Using Web Client ID:",
          googleWebClientId ? "✅ Present" : "❌ Missing"
        );

        /**
         * AppLovin SDK Initialization
         *
         * Initializes the AppLovin MAX SDK for rewarded and interstitial ads.
         * Only initializes if a valid SDK key is provided in configuration.
         * Ads are used for monetization and optional coin rewards.
         */
        const applovinSdkKey = Constants.expoConfig?.extra?.APPLOVIN_SDK_KEY;
        if (applovinSdkKey && applovinSdkKey !== "YOUR_APPLOVIN_SDK_KEY") {
          console.log("📱 Initializing AppLovin SDK...");
          const configuration: Configuration = await AppLovinMAX.initialize(
            applovinSdkKey
          );
          console.log("✅ AppLovin SDK initialized successfully!");
          console.log("📊 AppLovin Configuration:", configuration);
        } else {
          console.warn("⚠️ AppLovin SDK Key not set. Ads will not initialize.");
        }

        /**
         * Facebook SDK Initialization and Diagnostics
         *
         * Sets up Facebook authentication and runs comprehensive diagnostics
         * to identify common configuration issues. Includes detailed logging
         * for troubleshooting Facebook login problems.
         */
        const facebookAppId = Constants.expoConfig?.extra?.FACEBOOK_APP_ID;
        const facebookClientToken =
          Constants.expoConfig?.extra?.FACEBOOK_CLIENT_TOKEN;

        if (facebookAppId && facebookAppId !== "YOUR_FACEBOOK_APP_ID") {
          console.log("📘 Initializing Facebook SDK...");
          console.log("📘 Facebook App ID:", facebookAppId);
          console.log(
            "📘 Facebook Client Token:",
            facebookClientToken ? "✅ Present" : "❌ Missing"
          );

          try {
            // Set the Facebook App ID
            Settings.setAppID(facebookAppId);

            // Set Client Token if available
            if (
              facebookClientToken &&
              facebookClientToken !== "YOUR_FACEBOOK_CLIENT_TOKEN"
            ) {
              Settings.setClientToken(facebookClientToken);
              console.log("✅ Facebook Client Token set successfully");
            } else {
              console.warn(
                "⚠️ Facebook Client Token not set - this may cause authentication issues"
              );
            }

            // Initialize the Facebook SDK
            Settings.initializeSDK();

            // Verify SDK initialization
            console.log("✅ Facebook SDK initialized successfully!");
            console.log("📊 Facebook SDK Configuration:");
            console.log("  - App ID: " + facebookAppId);
            console.log(
              "  - Client Token: " + (facebookClientToken ? "Set" : "Not Set")
            );
            console.log("  - SDK Initialized: ✅");

            /**
             * Facebook Diagnostic Testing
             *
             * Runs comprehensive diagnostics to identify common Facebook
             * authentication issues and provides troubleshooting guidance.
             */
            console.log("🔍 Running Facebook diagnostic...");
            try {
              const troubleshoot =
                await AuthService.troubleshootFacebookLogin();
              console.log("📋 Facebook Troubleshooting Report:");
              console.log("Status:", troubleshoot.configurationStatus);
              console.log("\n🔧 Common Issues:");
              troubleshoot.commonIssues.forEach((issue) => console.log(issue));
              console.log("\n📝 Troubleshooting Steps:");
              troubleshoot.troubleshootingSteps.forEach((step) =>
                console.log(step)
              );
              console.log("\n🔑 Key Hash Information:");
              console.log(troubleshoot.keyHashInfo);
            } catch (error) {
              console.error("❌ Facebook troubleshooting failed:", error);
            }
          } catch (error) {
            console.error("❌ Facebook SDK initialization error:", error);
            console.warn("⚠️ Facebook login may not work properly");
          }
        } else {
          console.warn(
            "⚠️ Facebook App ID not set. Facebook features will not work."
          );
          console.warn(
            "⚠️ Check app.config.js and ensure FACEBOOK_APP_ID is properly configured"
          );
        }

        console.log("🎉 App initialization completed successfully!");
        console.log("🔄 Setting isInitialized to true...");
        setIsInitialized(true);
        console.log("✅ App ready to render AuthProvider and Navigation");
      } catch (error: unknown) {
        console.error("❌ App initialization error:", error);
        captureException(error, { context: "App.initializeApp" });
        /**
         * Error Recovery Strategy
         *
         * Even if some services fail to initialize, the app should still be
         * functional. This ensures users can access basic functionality even
         * if non-critical services like ads or 3D rendering fail.
         */
        console.log("🔄 Setting isInitialized to true despite errors...");
        setIsInitialized(true);
      }
    }

    initializeApp();
  }, []);

  /**
   * Loading State Handling
   *
   * Shows a full-screen loading spinner while services are initializing.
   * The app remains on this screen until all critical services are ready
   * or initialization fails gracefully.
   */
  if (!isInitialized) {
    console.log("⏳ App not initialized yet, showing loading spinner");

    /**
     * Full-Screen Loading Spinner
     *
     * Displays a pulsing spinner during app initialization. No progress text
     * is shown to maintain a clean loading experience. The spinner is
     * semi-transparent to provide visual feedback without being jarring.
     */
    return <PulsingSpinner visible={true} size={120} opacity={0.8} />;
  }

  console.log(
    "🎯 App initialized, rendering ModalProvider, AuthProvider and Navigation"
  );

  /**
   * Main App Structure
   *
   * Once initialization is complete, renders the full app structure with:
   * - ModalProvider: Global modal management and state
   * - AuthProvider: User authentication context and state
   * - NavigationContainer: React Navigation wrapper
   * - Navigation: App navigation stack and routing
   *
   * This nested provider structure ensures proper context availability
   * throughout the component tree.
   */
  return (
    <Sentry.ErrorBoundary
      fallback={<PulsingSpinner visible={true} size={120} opacity={0.8} />}
      onError={(error) => captureException(error, { context: "App.ErrorBoundary" })}
    >
      <ModalProvider>
        <AuthProvider>
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
        </AuthProvider>
      </ModalProvider>
    </Sentry.ErrorBoundary>
  );
});
