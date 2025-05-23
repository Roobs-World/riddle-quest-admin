// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// Load default Expo Metro config
const config = getDefaultConfig(__dirname);

// Ensure that we use `withNativeWind` to wrap the base config first,
// then apply other custom transformations.
const windConfig = withNativeWind(config, {
  input: "./global.css",
});

// Configure SVG support via react-native-svg-transformer on the wrapped config
windConfig.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

// Treat .svg files as source, not assets on the wrapped config
windConfig.resolver.assetExts = windConfig.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
windConfig.resolver.sourceExts = [
  ...windConfig.resolver.sourceExts,
  "svg",
  "ts",
  "tsx",
  "mts",
];

// Add this to shim 'fs'
windConfig.resolver.extraNodeModules = {
  fs: false,
  // You can add other Node.js core modules here if needed, e.g.:
  // path: false,
  // os: false,
};

// --- New blockList approach ---
const firebaseNodeModulesPath = path.resolve(
  __dirname,
  "firebase-functions/node_modules"
);
// Escape special characters for regex
const escapedFirebasePath = firebaseNodeModulesPath.replace(
  /[.*+?^${}()|[\\]\\]/g,
  "\\$&"
);

windConfig.resolver.blockList = [
  new RegExp(/(\/__tests__\/.*)$/.source), // Keep the __tests__ pattern
  new RegExp(escapedFirebasePath + "/.*"), // Our new rule as RegExp
];
// --- End new blockList approach ---

// Export the final configured object
module.exports = windConfig;
