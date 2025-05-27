// metro.config.js - Minimal config to bypass Metro dependency issues
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// Load default Expo Metro config
const config = getDefaultConfig(__dirname, {
  // Disable problematic features that cause importLocationsPlugin errors
  isCSSEnabled: true,
});

// Disable package exports to prevent module resolution issues
config.resolver.unstable_enablePackageExports = false;

// Apply NativeWind configuration
const windConfig = withNativeWind(config, {
  input: "./global.css",
});

// Configure SVG support
windConfig.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

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

// Add Node.js core module shims
windConfig.resolver.extraNodeModules = {
  fs: false,
};

// Block Firebase Functions node_modules
const firebaseNodeModulesPath = path.resolve(
  __dirname,
  "firebase-functions/node_modules"
);
const escapedFirebasePath = firebaseNodeModulesPath.replace(
  /[.*+?^${}()|[\\]\\]/g,
  "\\$&"
);

windConfig.resolver.blockList = [
  new RegExp(/(\/__tests__\/.*)$/.source),
  new RegExp(escapedFirebasePath + "/.*"),
];

module.exports = windConfig;
