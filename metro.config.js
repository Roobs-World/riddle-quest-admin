// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

module.exports = (() => {
  // Load default Expo Metro config
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;

  // Configure SVG support via react-native-svg-transformer
  transformer.babelTransformerPath = require.resolve(
    "react-native-svg-transformer"
  );

  // Treat .svg files as source, not assets
  resolver.assetExts = resolver.assetExts.filter((ext) => ext !== "svg");
  resolver.sourceExts = [...resolver.sourceExts, "svg"];

  // Wrap with NativeWind to enable Tailwind support
  return withNativeWind(config, {
    input: "./global.css",
  });
})();
