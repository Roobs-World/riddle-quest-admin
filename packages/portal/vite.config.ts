import {defineConfig} from "vite";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {sentryVitePlugin} from "@sentry/vite-plugin";
import {fileURLToPath, URL} from "node:url";

const portalEnvironmentDirectory = fileURLToPath(new URL("../../config/vite/portal/", import.meta.url));

export default defineConfig(({command}) => {
  const uploadSentrySourceMaps = process.env.SENTRY_UPLOAD_SOURCEMAPS === "1";
  const jestBuildOutDir = process.env.JEST_BUILD_OUT_DIR?.trim() || "dist-jest";
  const sentryBuildEnvironment = {
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    release: process.env.SENTRY_RELEASE,
  };
  if (uploadSentrySourceMaps) {
    const missing = Object.entries(sentryBuildEnvironment)
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Private Sentry source-map upload requires: ${missing.join(", ")}`);
    }
  }

  const plugins = [react(), babel({presets: [reactCompilerPreset()]})];
  if (uploadSentrySourceMaps) {
    plugins.push(sentryVitePlugin({
      authToken: sentryBuildEnvironment.authToken,
      org: sentryBuildEnvironment.org,
      project: sentryBuildEnvironment.project,
      telemetry: false,
      sourcemaps: {
        assets: `${jestBuildOutDir}/**`,
        filesToDeleteAfterUpload: `${jestBuildOutDir}/**/*.map`,
      },
      release: {
        name: sentryBuildEnvironment.release,
        inject: false,
        create: true,
        finalize: true,
        setCommits: false,
        deploy: {env: "production"},
      },
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeTracing: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },
    }));
  }

  return {
    base: process.env.JEST_BUILD === "1" ? "./" : "/riddle-quest/",
    devtools: command === "serve",
    envDir: portalEnvironmentDirectory,
    envPrefix: "VITE_",
    plugins,
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ["warn", "error"],
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@qwordly/core/bridge/constants": fileURLToPath(new URL("../core/src/bridge/constants.ts", import.meta.url)),
        "@qwordly/core/bridge": fileURLToPath(new URL("../core/src/bridge/index.ts", import.meta.url)),
        "@qwordly/core/pricing/catalog": fileURLToPath(new URL("../core/src/pricing/catalog.ts", import.meta.url)),
        "@qwordly/core/race": fileURLToPath(new URL("../core/src/race/index.ts", import.meta.url)),
        "@qwordly/core/referrals": fileURLToPath(new URL("../core/src/referrals/index.ts", import.meta.url)),
        "@qwordly/core/validation": fileURLToPath(new URL("../core/src/validation/index.ts", import.meta.url)),
        "@qwordly/core/game": fileURLToPath(new URL("../core/src/game/index.ts", import.meta.url)),
        "@qwordly/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: uploadSentrySourceMaps ? "hidden" : false,
      chunkSizeWarningLimit: 450,
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: /node_modules[\/](?:react|react-dom|scheduler)[\/]/,
                priority: 30,
              },
              {
                name: "vendor-three",
                test: /node_modules[\/]three[\/]src[\/]/,
                maxSize: 280 * 1024,
                priority: 25,
              },
              {
                name: "vendor-firebase",
                test: /node_modules[\/](?:@firebase|firebase)[\/]/,
                priority: 20,
              },
              {name: "app-i18n", test: /[\/]src[\/]i18n[\/]/, priority: 15},
              {
                name: "core-bridge-constants",
                test: /[\/]packages[\/]core[\/]src[\/]bridge[\/]constants\.ts$/,
                priority: 15,
              },
              {name: "core-game", test: /[\/]packages[\/]core[\/]src[\/]game[\/]/, priority: 10},
            ],
          },
        },
      },
    },
  };
});
