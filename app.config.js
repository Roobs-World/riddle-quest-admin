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
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: false,
    package: "com.grindhead.qwordly",
    googleServicesFile: "./google-services.json",
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
        appID: "1568112680678349",
        clientToken: "your_facebook_client_token_here",
        displayName: "Qwordly",
        scheme: "fb1568112680678349",
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
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "c587e97f-f71b-4258-a34c-98a2df4a6508",
    },
    OPEN_AI_KEY: "YnDnl1dSucAApjYEN019-6hGt2ufiedaq4HsP-h7",
    FIREBASE_API_KEY: "AIzaSyBNjLrkvGibqctZ30YIktDYUBGf1WMhUBs",
    FIREBASE_APP_ID: "1:26666910831:android:38c5f64b1df8df7168799a",
    FIREBASE_AUTH_DOMAIN: "qwordly-6ba44.firebaseapp.com",
    FIREBASE_MESSAGING_SENDER_ID: "26666910831",
    FIREBASE_PROJECT_ID: "qwordly-6ba44",
    FIREBASE_STORAGE_BUCKET: "qwordly-6ba44.firebaseystorage.app",
    FACEBOOK_APP_ID: "1568112680678349",
    FACEBOOK_APP_SECRET: "eb2331d7805417d6b366408d2db245de",
    FACEBOOK_CLIENT_TOKEN: "your_facebook_client_token_here",
    APPLOVIN_INTERSTITIAL_AD_UNIT_ID: "YOUR_INTERSTITIAL_AD_UNIT_ID_HERE",
    APPLOVIN_REWARDED_AD_UNIT_ID: "YOUR_REWARDED_AD_UNIT_ID_HERE",
    APPLOVIN_SDK_KEY:
      "l0DW3tQICL3wzDHvHp2_94_T9l9RTheo_ETqTv9wek0c2BLUG17QClOTHhLNUB_3SusS4e8PEfmokc9ymTO0px",
  },
};
