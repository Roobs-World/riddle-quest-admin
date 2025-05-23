// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

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

// Export the final configured object
module.exports = windConfig;
