const path = require("node:path");
const {getDefaultConfig, mergeConfig} = require("@react-native/metro-config");

/** Repository root that holds the pnpm store and shared source folders. */
const repositoryRoot = path.resolve(__dirname, "../../..");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
/** Optional machine-local hosted configuration (gitignored); the example ships production defaults. */
const hostedConfigPath = ["hosted.config.json", "hosted.config.example.json"]
  .map((name) => path.join(__dirname, name))
  .find((candidate) => require("node:fs").existsSync(candidate));

const config = {
  watchFolders: [repositoryRoot],
  resolver: {
    nodeModulesPaths: [path.join(__dirname, "node_modules"), path.join(repositoryRoot, "node_modules")],
    resolveRequest: (context, moduleName, platform) => {
      // Shared sources use the native app's React and Firebase instances.
      if (moduleName === "react" || moduleName.startsWith("react/") || moduleName === "firebase" || moduleName.startsWith("firebase/")) {
        return context.resolveRequest({...context, originModulePath: path.join(__dirname, "index.js")}, moduleName, platform);
      }
      if (moduleName === "#hosted-config") return {type: "sourceFile", filePath: hostedConfigPath};
      if (moduleName === "#solo-content") {
        return {type: "sourceFile", filePath: path.join(repositoryRoot, "src/content/generated/youtube-content-v1.json")};
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
