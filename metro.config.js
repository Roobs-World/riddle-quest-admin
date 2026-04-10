const fs = require("fs");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

// Load default Expo Metro config
const config = getSentryExpoConfig(__dirname, {
  // Disable problematic features that cause importLocationsPlugin errors
  isCSSEnabled: true,
});

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

const existingReporter = windConfig.reporter;
windConfig.reporter = {
  update(event) {
    if (event?.type === "bundling_error") {
      const details = event?.error || event;
      console.error("[metro:bundling_error]", details);
    } else if (event?.type === "transform_cache_reset") {
      console.log("[metro:transform_cache_reset]");
    } else if (event?.type === "worker_stdout_chunk" || event?.type === "worker_stderr_chunk") {
      const chunk = Buffer.isBuffer(event.chunk)
        ? event.chunk.toString("utf8")
        : String(event.chunk || "");
      if (chunk.trim()) {
        console.log(`[metro:${event.type}]`, chunk.trim());
      }
    }

    if (typeof existingReporter?.update === "function") {
      existingReporter.update(event);
    }
  },
};

// Configure SVG support
windConfig.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
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

// Optional Metro TLS support for HTTPS/WSS local development.
// Enable by setting METRO_TLS_CERT_PATH and METRO_TLS_KEY_PATH.
const tlsCertPath = process.env.METRO_TLS_CERT_PATH;
const tlsKeyPath = process.env.METRO_TLS_KEY_PATH;
const tlsCaPath = process.env.METRO_TLS_CA_PATH;
if (tlsCertPath && tlsKeyPath) {
  windConfig.server = windConfig.server || {};
  windConfig.server.tls = {
    cert: fs.readFileSync(path.resolve(__dirname, tlsCertPath)),
    key: fs.readFileSync(path.resolve(__dirname, tlsKeyPath)),
    ...(tlsCaPath
      ? { ca: fs.readFileSync(path.resolve(__dirname, tlsCaPath)) }
      : {}),
  };
}

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
