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
  newArchEnabled: true,
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
    edgeToEdgeEnabled: true,
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
    "./plugins/withAndroidIapStoreSelection.js",
  ],
  extra: {
    eas: {
      projectId: "c587e97f-f71b-4258-a34c-98a2df4a6508",
    },
    SPREADSHEET_ID: "1SgsMqvbLx7n0FO6LlswzW9duEHfbs4V2-A43p8mP-uw",
    ACCESS_TOKEN: "AIzaSyDjnILvEvKu_dhFkN_qSFhLQaKXqguAvQw",
    OPEN_AI_KEY: "YnDnl1dSucAApjYEN019-6hGt2ufiedaq4HsP-h7",
    FIREBASE_API_KEY: "AIzaSyBNjLrkvGibqctZ30YIktDYUBGf1WMhUBs",
    FIREBASE_APP_ID: "1:26666910831:android:38c5f64b1df8df7168799a",
    FIREBASE_AUTH_DOMAIN: "qwordly-6ba44.firebaseapp.com",
    FIREBASE_MESSAGING_SENDER_ID: "26666910831",
    FIREBASE_PROJECT_ID: "qwordly-6ba44",
    FIREBASE_STORAGE_BUCKET: "qwordly-6ba44.firebaseystorage.app",
    FACEBOOK_APP_ID: "1568112680678349",
    FACEBOOK_APP_SECRET: "eb2331d7805417d6b366408d2db245de",
    APPLOVIN_INTERSTITIAL_AD_UNIT_ID: "YOUR_INTERSTITIAL_AD_UNIT_ID_HERE",
    APPLOVIN_REWARDED_AD_UNIT_ID: "YOUR_REWARDED_AD_UNIT_ID_HERE",
    APPLOVIN_SDK_KEY:
      "l0DW3tQICL3wzDHvHp2_94_T9l9RTheo_ETqTv9wek0c2BLUG17QClOTHhLNUB_3SusS4e8PEfmokc9ymTO0px",
  },
};
