// Force Expo to load the Firebase Crashlytics config plugin via a local wrapper.
// This avoids plugin resolution issues in environments where package export
// detection falls back to the library entrypoint instead of app.plugin.js.
module.exports = require("@react-native-firebase/crashlytics/app.plugin.js");
