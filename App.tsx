import "./global.css";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { loadFonts } from "./src/utils/fontLoader";
import { SoundManager } from "./src/services/SoundManager";
import Constants from "expo-constants";
import { Settings } from "react-native-fbsdk-next";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AuthProvider } from "./src/contexts/AuthContext";
import { Navigation } from "./src/navigation/NavigationStack";
import AppLovinMAX, { Configuration } from "react-native-applovin-max";
import PulsingSpinner from "./src/components/loading/PulsingSpinner";
import { AuthService } from "./src/services/AuthService";
import { SolarSystemPreloader } from "./src/services/SolarSystemPreloader";
import crashlytics from "@react-native-firebase/crashlytics";
export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Effect to load all static resources and initialize services
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log("🚀 Starting app initialization...");

        // Initialize Firebase Crashlytics
        console.log("📊 Initializing Firebase Crashlytics...");
        crashlytics().log("App initialization started");
        console.log("✅ Firebase Crashlytics initialized successfully!");

        // Clear any existing solar system cache to start fresh
        SolarSystemPreloader.clearCache();
        console.log("🧹 Cleared solar system cache");

        // Load fonts and initialize sound manager
        console.log("📝 Loading fonts...");
        await loadFonts();
        console.log("🔊 Initializing sound manager...");
        await SoundManager.init();
        console.log("✅ Fonts and sound manager initialized");

        // Preload 3D solar system during app initialization with timeout protection
        console.log("🌌 Preloading 3D solar system...");

        try {
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

          // Provide detailed debugging information
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

        // Initialize Google Sign-In
        console.log("🔑 Configuring Google Sign-In...");
        GoogleSignin.configure({
          webClientId:
            "26666910831-20c5akqranakimukl895h7bpdc9pf5c5.apps.googleusercontent.com", // Web client ID from google-services.json
          offlineAccess: true,
        });
        console.log("✅ Google Sign-In configured successfully!");

        // Initialize AppLovin SDK
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

        // Initialize Facebook SDK
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

            // Run Facebook diagnostic
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
        // Even if some services fail to initialize, we should still show the app
        console.log("🔄 Setting isInitialized to true despite errors...");
        setIsInitialized(true);
      }
    }

    initializeApp();
  }, []);

  // Show loading overlay while initializing
  if (!isInitialized) {
    console.log("⏳ App not initialized yet, showing loading spinner");

    // Show only spinner, no progress text, during 3D solar system loading
    return <PulsingSpinner visible={true} size={120} opacity={0.8} />;
  }

  console.log("🎯 App initialized, rendering AuthProvider and Navigation");
  return (
    <AuthProvider>
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}
