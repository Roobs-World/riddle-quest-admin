// This import block will be removed.
// const {
//   withFirebaseAndroid,
//   withFirebaseIOS,
// } = require("@react-native-firebase/app");

module.exports = {
  name: "Qwordly",
  slug: "qwordly",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: false,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.grindhead.qwordly",
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      NSUserTrackingUsageDescription:
        "This identifier will be used to deliver personalized ads to you.",
      NSCameraUsageDescription:
        "This app needs access to camera to capture profile photos.",
      NSPhotoLibraryUsageDescription:
        "This app needs access to photo library to select profile photos.",
      // Enhanced audio session configuration for high-quality playback
      UIBackgroundModes: ["audio"],
      AVAudioSessionCategoryOptions: [
        "AVAudioSessionCategoryOptionMixWithOthers",
        "AVAudioSessionCategoryOptionAllowBluetooth",
        "AVAudioSessionCategoryOptionDefaultToSpeaker",
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: false,
    package: "com.grindhead.qwordly",
    googleServicesFile: "./google-services.json",
    // Audio quality permissions and settings
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
    // Development build configuration to help with Google Play Services
    versionCode: 1,
    allowBackup: false,
  },
  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "@react-native-firebase/app",
    "@react-native-google-signin/google-signin",
    [
      "react-native-fbsdk-next",
      {
        appID: "1249521063516632",
        clientToken: "3b513e77a89b821d83a13d0847a16afe",
        displayName: "Qwordly",
        scheme: "fb1249521063516632",
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
      },
    ],
    "./plugins/withAndroidIapStoreSelection.js",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
          kotlinVersion: "2.0.21",
          // Enhanced audio processing - preserve maximum quality
          proguardMinifyEnabled: false, // Disable minification to preserve audio quality
          resourceShrinkingEnabled: false, // Disable resource shrinking for audio assets
          compressionEnabled: false, // Disable asset compression
          packagingOptions: {
            pickFirst: ["**/libc++_shared.so", "**/libjsc.so"],
            doNotStrip: ["**/*.so"], // Preserve native audio libraries
          },
        },
        ios: {
          // Enhanced audio configuration for iOS - preserve maximum quality
          deploymentTarget: "16.0",
          // Disable bitcode to preserve audio library quality
          bitcodeEnabled: false,
          // Preserve debug symbols for audio debugging
          includeSymbols: true,
          // Disable app thinning for audio assets
          appThinning: {
            disabled: true,
          },
        },
      },
    ],
    // Add expo-av plugin with audio optimization
    [
      "expo-av",
      {
        microphonePermission:
          "Allow $(PRODUCT_NAME) to access your microphone for enhanced audio features.",
        // Enhanced audio quality configuration
        audioSessionCategoryIOS: "playback", // Optimize for high-quality playback
        audioSessionModeIOS: "default", // Use default mode for best quality
        audioSessionCategoryOptionsIOS: [
          "mixWithOthers",
          "allowBluetooth",
          "defaultToSpeaker",
        ],
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "c587e97f-f71b-4258-a34c-98a2df4a6508",
    },
    ENABLE_CRASH_TESTING: process.env.ENABLE_CRASH_TESTING || "false",
    OPEN_AI_KEY: "YnDnl1dSucAApjYEN019-6hGt2ufiedaq4HsP-h7",
    FIREBASE_API_KEY: "AIzaSyBNjLrkvGibqctZ30YIktDYUBGf1WMhUBs",
    FIREBASE_APP_ID: "1:26666910831:android:38c5f64b1df8df7168799a",
    FIREBASE_AUTH_DOMAIN: "qwordly-6ba44.firebaseapp.com",
    FIREBASE_MESSAGING_SENDER_ID: "26666910831",
    FIREBASE_PROJECT_ID: "qwordly-6ba44",
    FIREBASE_STORAGE_BUCKET: "qwordly-6ba44.firebasestorage.app",
    FACEBOOK_APP_ID: "1249521063516632",
    FACEBOOK_APP_SECRET: "5e3500f7fade64706c26f3a26af4b28d",
    FACEBOOK_CLIENT_TOKEN: "3b513e77a89b821d83a13d0847a16afe",
    APPLOVIN_INTERSTITIAL_AD_UNIT_ID: "YOUR_INTERSTITIAL_AD_UNIT_ID_HERE",
    APPLOVIN_REWARDED_AD_UNIT_ID: "YOUR_REWARDED_AD_UNIT_ID_HERE",
    APPLOVIN_SDK_KEY:
      "l0DW3tQICL3wzDHvHp2_94_T9l9RTheo_ETqTv9wek0c2BLUG17QClOTHhLNUB_3SusS4e8PEfmokc9ymTO0px",
  },
  // Asset optimization to preserve audio quality
  assetBundlePatterns: ["**/*"],
};
