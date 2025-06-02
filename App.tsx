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

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Effect to load all static resources and initialize services
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log("🚀 Starting app initialization...");

        // Load fonts and initialize sound manager
        console.log("📝 Loading fonts...");
        await loadFonts();
        console.log("🔊 Initializing sound manager...");
        await SoundManager.init();
        console.log("✅ Fonts and sound manager initialized");

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
        if (facebookAppId && facebookAppId !== "YOUR_FACEBOOK_APP_ID") {
          console.log("📘 Initializing Facebook SDK...");
          // Set the Facebook App ID
          Settings.setAppID(facebookAppId);
          // Initialize the Facebook SDK
          Settings.initializeSDK();
          console.log("✅ Facebook SDK initialized successfully!");
        } else {
          console.warn(
            "⚠️ Facebook App ID not set. Facebook features will not work."
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
    return <PulsingSpinner visible={true} size={120} />;
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
