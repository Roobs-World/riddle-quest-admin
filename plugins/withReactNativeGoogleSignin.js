// Force Expo to resolve the Google Sign-In config plugin directly.
// This avoids Node trying to load the package ESM app entry while resolving
// plugins in certain Expo CLI execution paths.
module.exports = require("@react-native-google-signin/google-signin/app.plugin.js");
