import "./global.css";
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { loadFonts } from "./src/utils/fontLoader";
import { SoundManager } from "./src/services/SoundManager";
import Constants from "expo-constants";
import { Settings } from "react-native-fbsdk-next";
import { AuthProvider } from "./src/contexts/AuthContext";
import { Navigation } from "./src/navigation/NavigationStack";
import AppLovinMAX, { Configuration } from "react-native-applovin-max";

export default function App() {
  // Effect to load static resources like fonts
  useEffect(() => {
    async function loadStaticResources() {
      try {
        await loadFonts();
        await SoundManager.init();
      } catch (error: unknown) {
        console.error("App load error:", error);
      }
    }

    loadStaticResources();
  }, []);

  // Effect to initialize AppLovin SDK
  useEffect(() => {
    const initializeAppLovin = async () => {
      const applovinSdkKey = Constants.expoConfig?.extra?.APPLOVIN_SDK_KEY;

      if (!applovinSdkKey || applovinSdkKey === "YOUR_APPLOVIN_SDK_KEY") {
        console.error("AppLovin SDK Key not set. Ads will not initialize.");
        return;
      }

      console.log("Initializing AppLovin SDK...");

      try {
        const configuration: Configuration = await AppLovinMAX.initialize(
          applovinSdkKey
        );
        console.log("AppLovin SDK initialized successfully!");
        console.log("AppLovin Configuration:", configuration);
      } catch (error) {
        console.error("AppLovin SDK failed to initialize:", error);
      }
    };

    initializeAppLovin();
  }, []);

  // Effect to initialize Facebook SDK
  useEffect(() => {
    const initializeFacebookSDK = async () => {
      const facebookAppId = Constants.expoConfig?.extra?.FACEBOOK_APP_ID;

      if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID") {
        console.error(
          "Facebook App ID not set. Facebook features will not work."
        );
        return;
      }

      console.log("Initializing Facebook SDK...");

      try {
        // Set the Facebook App ID
        Settings.setAppID(facebookAppId);

        // Initialize the Facebook SDK
        Settings.initializeSDK();

        console.log("Facebook SDK initialized successfully!");
      } catch (error) {
        console.error("Facebook SDK failed to initialize:", error);
      }
    };

    initializeFacebookSDK();
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}
