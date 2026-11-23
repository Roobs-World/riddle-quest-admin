const path = require("node:path");
const {getDefaultConfig, mergeConfig} = require("@react-native/metro-config");

/** Monorepo root that holds the pnpm store and the shared workspace packages. */
const repositoryRoot = path.resolve(__dirname, "../..");

/**
 * Workspace sources resolved straight to TypeScript so Metro bundles the exact
 * modules the web targets compile, without a separate build step. Longer
 * specifiers are listed before their prefixes.
 */
const workspaceSources = {
  "#solo-content": path.join(repositoryRoot, "packages/portal/src/playable/generated/youtube-content-v1.json"),
  "@riddle-quest/hosted": path.join(repositoryRoot, "packages/hosted/src/index.ts"),
  "@riddle-quest/solo/react": path.join(repositoryRoot, "packages/solo/src/react/index.ts"),
  "@riddle-quest/solo": path.join(repositoryRoot, "packages/solo/src/index.ts"),
  "@riddle-quest/core/validation/androidEntryInbox": path.join(repositoryRoot, "packages/core/src/validation/androidEntryInbox.ts"),
  "@riddle-quest/core/game": path.join(repositoryRoot, "packages/core/src/game/index.ts"),
  "@riddle-quest/core": path.join(repositoryRoot, "packages/core/src/index.ts"),
};

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
      // Shared workspace sources use the native app's React and Firebase instances.
      if (moduleName === "react" || moduleName.startsWith("react/") || moduleName === "firebase" || moduleName.startsWith("firebase/")) {
        return context.resolveRequest({...context, originModulePath: path.join(__dirname, "index.js")}, moduleName, platform);
      }
      if (moduleName === "#hosted-config") return {type: "sourceFile", filePath: hostedConfigPath};
      if (moduleName.startsWith("@riddle-quest/hosted/")) {
        return {type: "sourceFile", filePath: path.join(repositoryRoot, "packages/hosted/src", `${moduleName.slice("@riddle-quest/hosted/".length)}.ts`)};
      }
      /** Shared workspace module mapped to its TypeScript source. */
      const filePath = workspaceSources[moduleName];
      if (filePath) return {type: "sourceFile", filePath};
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
