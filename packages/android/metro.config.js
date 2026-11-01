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
  "@qwordly/solo/react": path.join(repositoryRoot, "packages/solo/src/react/index.ts"),
  "@qwordly/solo": path.join(repositoryRoot, "packages/solo/src/index.ts"),
  "@qwordly/core/game": path.join(repositoryRoot, "packages/core/src/game/index.ts"),
  "@qwordly/core": path.join(repositoryRoot, "packages/core/src/index.ts"),
};

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [repositoryRoot],
  resolver: {
    nodeModulesPaths: [path.join(__dirname, "node_modules"), path.join(repositoryRoot, "node_modules")],
    resolveRequest: (context, moduleName, platform) => {
      /** Shared workspace module mapped to its TypeScript source. */
      const filePath = workspaceSources[moduleName];
      if (filePath) return {type: "sourceFile", filePath};
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
