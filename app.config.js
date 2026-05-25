/**
 * @fileoverview Expo application configuration for Riddle Quest - riddle-based Wordle clone.
 *
 * This configuration file defines all aspects of the Expo/EAS build process including:
 * - Basic app metadata (name, version, icons)
 * - Platform-specific settings (iOS/Android)
 * - Plugin configurations (Firebase, authentication, ads)
 * - Build optimization settings
 * - Environment variable definitions
 *
 * The configuration is structured to support both development and production
 * environments with optimized settings for audio quality, 3D rendering,
 * and cross-platform compatibility.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

// Load environment variables
require("dotenv").config();
const fs = require("fs");

const sentryOrg = process.env.SENTRY_ORG || process.env.SENTRY_ORGANIZATION;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryUrl = process.env.SENTRY_URL || "https://sentry.io/";
const useSentryExpoPlugin = Boolean(sentryOrg && sentryProject);
const GOOGLE_MOBILE_ADS_ANDROID_TEST_APP_ID =
  "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_MOBILE_ADS_IOS_TEST_APP_ID =
  "ca-app-pub-3940256099942544~1458002511";
const googleMobileAdsAndroidAppId =
  process.env.GOOGLE_MOBILE_ADS_ANDROID_APP_ID ||
  process.env.ADMOB_ANDROID_APP_ID ||
  GOOGLE_MOBILE_ADS_ANDROID_TEST_APP_ID;
const googleMobileAdsIosAppId =
  process.env.GOOGLE_MOBILE_ADS_IOS_APP_ID ||
  process.env.ADMOB_IOS_APP_ID ||
  GOOGLE_MOBILE_ADS_IOS_TEST_APP_ID;
const getGoogleWebClientId = () => {
  if (process.env.GOOGLE_WEB_CLIENT_ID) {
    return process.env.GOOGLE_WEB_CLIENT_ID;
  }
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  }

  try {
    const googleServices = JSON.parse(
      fs.readFileSync("./google-services.json", "utf8")
    );
    const oauthClients = googleServices.client?.flatMap(
      (client) => client.oauth_client || []
    );
    const webClient = oauthClients?.find((client) => client.client_type === 3);
    if (webClient?.client_id) {
      return webClient.client_id;
    }
  } catch (error) {
    console.warn("Unable to derive Google web client ID.", error);
  }

  return "YOUR_GOOGLE_WEB_CLIENT_ID";
};
const googleWebClientId = getGoogleWebClientId();

/**
 * Expo Configuration Object
 *
 * Defines the complete application configuration for Expo/EAS builds.
 * Includes metadata, platform settings, plugins, and environment variables.
 */
module.exports = {
  /** Application display name shown to users */
  name: "Riddle Quest",

  /** URL-friendly app identifier used by Expo */
  slug: "riddle-quest",

  /** Application version for app stores and updates */
  version: "1.0.0",

  /** Lock app to portrait orientation for optimal game experience */
  orientation: "portrait",

  /** App icon displayed on device home screens */
  icon: "./assets/images/icon.png",

  /** UI style preference - light mode for better visibility */
  userInterfaceStyle: "light",

  /**
   * Splash Screen Configuration
   *
   * Defines the loading screen shown when the app starts.
   * Uses contain mode to preserve aspect ratio of the splash icon.
   */
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },

  /**
   * iOS Platform Configuration
   *
   * iOS-specific settings including bundle identifier, permissions,
   * audio configuration, and Google Services integration.
   */
  ios: {
    /** Enable iPad support for larger screen gameplay */
    supportsTablet: true,

    /** Unique iOS bundle identifier for App Store */
    bundleIdentifier: "com.roobsworld.riddlequest",

    /** Firebase configuration file for iOS */
    googleServicesFile: "./GoogleService-Info.plist",

    /**
     * iOS Info.plist Configuration
     *
     * Defines permissions and audio session settings for iOS.
     * Optimized for high-quality audio playback and camera/photo access.
     */
    infoPlist: {
      /** Ad tracking permission description */
      NSUserTrackingUsageDescription:
        "This identifier will be used to deliver personalized ads to you.",

      /** Camera access permission for profile photos */
      NSCameraUsageDescription:
        "This app needs access to camera to capture profile photos.",

      /** Photo library access permission for profile photos */
      NSPhotoLibraryUsageDescription:
        "This app needs access to photo library to select profile photos.",

      /**
       * Enhanced Audio Session Configuration
       *
       * Configures iOS audio session for high-quality game audio
       * with background playback capabilities and device mixing.
       */
      UIBackgroundModes: ["audio"],
      AVAudioSessionCategoryOptions: [
        "AVAudioSessionCategoryOptionMixWithOthers",
        "AVAudioSessionCategoryOptionAllowBluetooth",
        "AVAudioSessionCategoryOptionDefaultToSpeaker",
      ],
    },
  },

  /**
   * Android Platform Configuration
   *
   * Android-specific settings including adaptive icons, permissions,
   * audio quality settings, and Google Services integration.
   */
  android: {
    /**
     * Adaptive Icon Configuration
     *
     * Provides foreground image for Android's adaptive icon system,
     * allowing the icon to adapt to different device themes and shapes.
     */
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#ffffff",
    },

    /** Unique Android package name for Google Play Store */
    package: "com.roobsworld.riddlequest",

    /** Firebase configuration file for Android */
    googleServicesFile: "./google-services.json",

    /**
     * Android Audio Quality Permissions
     *
     * Permissions required for optimal audio performance and
     * quality on Android devices.
     */
    permissions: [
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],

    /** Disable automatic backup for game data security */
    allowBackup: false,
  },

  /**
   * Web Platform Configuration
   *
   * Settings for potential web deployment (currently unused but configured).
   */
  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
  },

  /**
   * Expo Plugins Configuration
   *
   * List of Expo plugins that add native functionality to the app.
   * Includes Firebase, authentication, ads, and build optimization plugins.
   */
  plugins: [
     /** Firebase Crashlytics for error tracking */
    "./plugins/withReactNativeFirebaseCrashlytics.js",
    "expo-asset",
    ...(useSentryExpoPlugin
      ? [
          [
            "@sentry/react-native/expo",
            {
              url: sentryUrl,
              organization: sentryOrg,
              project: sentryProject,
            },
          ],
        ]
      : []),
    /** Google Sign-In authentication */
    "./plugins/withReactNativeGoogleSignin.js",
    /**
     * Google Mobile Ads (AdMob) configuration for rewarded ads.
     * Uses official Google test app IDs by default for safe development builds.
     */
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: googleMobileAdsAndroidAppId,
        iosAppId: googleMobileAdsIosAppId,
      },
    ],

    /**
     * Facebook SDK Configuration
     *
     * Configures Facebook authentication with app-specific settings
     * and privacy-focused defaults (no auto-logging, no advertiser ID).
     * Uses environment variables for secure configuration.
     */
    [
      "react-native-fbsdk-next",
      {
        appID: process.env.FACEBOOK_APP_ID || "YOUR_FACEBOOK_APP_ID",
        clientToken:
          process.env.FACEBOOK_CLIENT_TOKEN || "YOUR_FACEBOOK_CLIENT_TOKEN",
        displayName: "Riddle Quest",
        scheme: `fb${process.env.FACEBOOK_APP_ID || "YOUR_FACEBOOK_APP_ID"}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
      },
    ],
    /** Custom plugin for Android IAP store selection */
    "./plugins/withAndroidIapStoreSelection.js",

    /**
     * Expo Build Properties Configuration
     *
     * Platform-specific build settings optimized for audio quality,
     * performance, and compatibility. Disables compression and
     * minification to preserve audio fidelity.
     */
    [
      "expo-build-properties",
      {
        /**
         * Android Build Configuration
         *
         * Optimized for audio quality and performance with
         * disabled compression and resource shrinking.
         */
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
          kotlinVersion: "2.0.21",

          /** Audio quality preservation settings */
          proguardMinifyEnabled: false, // Disable minification to preserve audio quality
          resourceShrinkingEnabled: false, // Disable resource shrinking for audio assets
          compressionEnabled: false, // Disable asset compression

          /** Native library packaging options */
          packagingOptions: {
            pickFirst: ["**/libc++_shared.so", "**/libjsc.so"],
            doNotStrip: ["**/*.so"], // Preserve native audio libraries
          },
        },

        /**
         * iOS Build Configuration
         *
         * Enhanced settings for audio quality and debugging
         * with bitcode disabled for library compatibility.
         */
        ios: {
          deploymentTarget: "16.4",
          bitcodeEnabled: false, // Disable bitcode to preserve audio library quality
          includeSymbols: true, // Preserve debug symbols for audio debugging

          /** Disable app thinning for audio assets */
          appThinning: {
            disabled: true,
          },
        },
      },
    ],

    /**
     * Expo Audio Plugin Configuration
     *
     * Configures expo-audio for high-quality audio playback (expo-av replacement in SDK 55).
     */
    [
      "expo-audio",
      {
        microphonePermission:
          "Allow $(PRODUCT_NAME) to access your microphone for enhanced audio features.",
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ],
  ],

  /**
   * Extra Configuration and Environment Variables
   *
   * Contains EAS project settings and environment variables for
   * Firebase, social authentication, advertising, and AI services.
   * All sensitive values are loaded from environment variables.
   */
  extra: {
    /** EAS (Expo Application Services) project identifier */
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID || "c564618a-a464-435d-847c-9c51fc695145",
    },

    /** Development and testing flags */
    ENABLE_CRASH_TESTING: process.env.ENABLE_CRASH_TESTING || "false",
    EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND:
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND || "false",

    /**
     * Firebase Configuration Variables
     *
     * Firebase project settings for authentication, database,
     * and storage services. All values loaded from environment variables.
     */
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID",
    FIREBASE_AUTH_DOMAIN:
      process.env.FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN",
    FIREBASE_MESSAGING_SENDER_ID:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    FIREBASE_PROJECT_ID:
      process.env.FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID",
    FIREBASE_STORAGE_BUCKET:
      process.env.FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET",

    /**
     * Google Authentication Configuration
     *
     * Google Sign-In web client ID from Firebase console.
     */
    GOOGLE_WEB_CLIENT_ID: googleWebClientId,

    /**
     * Facebook Authentication Configuration
     *
     * Facebook app credentials for social authentication.
     * All values loaded from environment variables for security.
     */
    FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || "YOUR_FACEBOOK_APP_ID",
    FACEBOOK_CLIENT_TOKEN:
      process.env.FACEBOOK_CLIENT_TOKEN || "YOUR_FACEBOOK_CLIENT_TOKEN",
  },

  /**
   * Asset Bundle Patterns
   *
   * Defines which assets to include in the app bundle.
   * The wildcard pattern includes all assets to preserve audio quality
   * and ensure all 3D models and textures are available.
   */
  assetBundlePatterns: ["**/*"],
};



