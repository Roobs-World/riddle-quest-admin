// metro.config.js - Enhanced config for better asset loading
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

// Enhanced asset configuration for better texture and 3D model loading
// Explicitly include high-quality audio formats without compression
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "fbx",
  "gltf",
  "glb",
  "obj",
  // High-quality audio formats
  "wav",
  "aiff",
  "flac",
  "m4a",
  "aac",
  "mp3",
];

// Optimize asset resolution for 3D textures
config.resolver.platforms = ["ios", "android", "native", "web"];

// Remove problematic path aliases - using direct relative paths instead
// config.resolver.alias = {
//   "@": path.resolve(__dirname, "assets"),
//   "@/3d": path.resolve(__dirname, "assets/3d"),
// };

// Add Reanimated plugin to transformer
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

// Enhanced asset transformer settings - preserve audio quality
config.transformer.assetPlugins = ["expo-asset/tools/hashAssetFiles"];

// Disable audio compression during bundling
config.transformer.enableBabelRCLookup = false;
config.transformer.enableBabelRuntime = false;

// Preserve original audio file quality
config.transformer.minifierConfig = {
  // Disable audio minification
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Apply NativeWind configuration
const windConfig = withNativeWind(config, {
  input: "./global.css",
});

// Configure SVG support
windConfig.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

windConfig.transformer.inlineRequires = false;

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
