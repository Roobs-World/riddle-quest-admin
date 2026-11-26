import {jestShaderIndentationPlugin, jestFirebaseScriptPolicyPlugin} from "../../../platforms/web/jest/tooling/jestArtifactPlugins.ts";
import {webBuildFacts} from "../../release/release-registry.mjs";
import {webTargetDependencyPlugin} from "./webTargetDependencies.ts";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {sentryVitePlugin} from "@sentry/vite-plugin";
import path from "node:path";
import {fileURLToPath, URL} from "node:url";
import type {ConfigEnv, Plugin, PluginOption, UserConfig} from "vite";

/** Provides portal package directory behavior. */
const portalPackageDirectory = fileURLToPath(new URL("../../../", import.meta.url));
/** Preserves the game-rule chunk membership after source files move into feature folders. */
const gameRuleSources = new Set([
  "src/gameplay/controllers/GameEngine.ts",
  "src/progression/achievements/achievementMilestones.ts",
  "src/progression/achievements/achievementRewards.ts",
  "src/progression/rewards/localCompletionRewards.ts",
  "src/gameplay/rules/computeFeedback.ts",
  "src/gameplay/rules/computeLetterStates.ts",
  "src/progression/economy/rewardRules.ts",
  "src/gameplay/input/graphemes.ts",
  "src/gameplay/rules/isValidGuess.ts",
  "src/gameplay/rules/limits.ts",
  "src/gameplay/input/singlePlayerKeyboard.ts",
  "src/gameplay/contracts/scoring.ts",
].map((file) => path.join(portalPackageDirectory, file)));
/** Provides shared shop modal page behavior. */
const sharedShopModalPage = fileURLToPath(new URL("../../../src/commerce/components/ShopModalPage.tsx", import.meta.url));
/** Provides jest html entry behavior. */
const jestHtmlEntry = fileURLToPath(new URL("../../../platforms/web/jest/index.html", import.meta.url));
/** The compile-time Web Targets shipped by the portal package. */
export type WebTarget = "jest";

/** Provides canonical build output directories behavior. */
const canonicalBuildOutputDirectories = Object.freeze(Object.fromEntries(
  Object.entries(webBuildFacts).map(([target, facts]) => [target, path.resolve(portalPackageDirectory, facts.outputDirectory)]),
)) as Readonly<Record<WebTarget, string>>;

/** Input to the single Web Target build-configuration interface. */
export type WebTargetViteConfigRequest = Readonly<{
  /** Stores command. */
  command: ConfigEnv["command"];
  /** Stores mode. */
  mode: string;
  /** Stores environment. */
  environment: Readonly<Record<string, string | undefined>>;
}>;

/** Describes web target profile. */
type WebTargetProfile = Readonly<{
  /** Stores id. */
  id: WebTarget;
  /** Stores shop entry. */
  shopEntry: string;
  /** Stores public directory. */
  publicDirectory: "public" | false;
  /** Stores input. */
  input: string | Readonly<Record<string, string>>;
  /** Stores html outputs. */
  htmlOutputs: readonly [Readonly<{/** Stores source. */
  /** Stores source. */
  source: string; /** Stores file name. */
  /** Stores file name. */
  fileName: string}>, ...Readonly<{/** Stores source. */
  /** Stores source. */
  source: string; /** Stores file name. */
  /** Stores file name. */
  fileName: string}>[]];
  /** Stores disable module preload polyfill. */
  disableModulePreloadPolyfill?: boolean;
  /** Creates artifact plugins. */
  createArtifactPlugins(): readonly PluginOption[];
}>;

/** Normalizes output path. */
function normalizeOutputPath(value: string): string {
  return value.split(path.sep).join("/");
}

/** Keeps target-owned source documents while presenting the artifact names each host requires. */
function targetHtmlPlugin(profile: WebTargetProfile, targetRoot: string): Plugin {
  return {
    name: "riddle-quest-web-target-html",
    enforce: "pre",
    generateBundle: {
      order: "post",
      /** Provides handler behavior. */
      handler(_options, bundle) {
        for (const htmlOutput of profile.htmlOutputs) {
          /** Provides source file name behavior. */
          const sourceFileName = normalizeOutputPath(path.relative(targetRoot, htmlOutput.source));
          /** Provides candidates behavior. */
          const candidates = Object.values(bundle).filter((output) =>
            output.type === "asset" && normalizeOutputPath(output.fileName) === sourceFileName
          );
          if (candidates.length !== 1) {
            throw new Error(
              `${profile.id} Web Target build expected one ${sourceFileName} HTML asset, found ${candidates.length}`,
            );
          }
          /** Provides [output] behavior. */
          const [output] = candidates;
          if (output.type !== "asset" || typeof output.source !== "string") {
            throw new Error(`${profile.id} Web Target HTML output was not a text asset`);
          }
          /** Provides source directory behavior. */
          const sourceDirectory = path.posix.dirname(sourceFileName);
          /** Provides relative asset prefix behavior. */
          const relativeAssetPrefix = sourceDirectory === "."
            ? "./"
            : "../".repeat(sourceDirectory.split("/").length);
          if (relativeAssetPrefix !== "./") {
            output.source = output.source
              .replaceAll(`\"${relativeAssetPrefix}`, '"./')
              .replaceAll(`'${relativeAssetPrefix}`, "'./");
          }
          output.fileName = htmlOutput.fileName;
        }
      },
    },
  };
}

/** Provides target profiles behavior. */
const targetProfiles: Readonly<Record<WebTarget, WebTargetProfile>> = Object.freeze({
  jest: Object.freeze({
    id: "jest",
    shopEntry: sharedShopModalPage,
    publicDirectory: "public",
    input: jestHtmlEntry,
    htmlOutputs: Object.freeze([{source: jestHtmlEntry, fileName: "index.html"}] as const),
    createArtifactPlugins: () => [],
  }),

});

/** Indicates whether is web target. */
function isWebTarget(mode: string): mode is WebTarget {
  return Object.hasOwn(targetProfiles, mode);
}

/** Resolves web target. */
function resolveWebTarget(mode: string): WebTargetProfile {
  if (isWebTarget(mode)) return targetProfiles[mode];
  throw new Error(`Unknown Web Target mode: ${mode}; expected jest`);
}

/** Provides contains path behavior. */
function containsPath(root: string, candidate: string): boolean {
  /** Provides relative behavior. */
  const relative = path.relative(root, candidate);
  return relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/** Fails before build output can escape or overwrite the selected Web Target boundary. */
function webTargetBuildContractPlugin(target: WebTarget, expectedOutDir: string): Plugin {
  return {
    name: "riddle-quest-web-target-build-contract",
    apply: "build",
    enforce: "pre",
    /** Provides config resolved behavior. */
    configResolved(config) {
      /** Provides project root behavior. */
      const projectRoot = path.resolve(config.root);
      /** Provides repository root behavior. */
      const repositoryRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
      /** Provides expected behavior. */
      const expected = path.resolve(projectRoot, expectedOutDir);
      /** Provides resolved behavior. */
      const resolved = path.resolve(projectRoot, config.build.outDir);
      /** Provides selected canonical behavior. */
      const selectedCanonical = path.resolve(projectRoot, canonicalBuildOutputDirectories[target]);
      /** Provides other canonical behavior. */
      const otherCanonical = Object.entries(canonicalBuildOutputDirectories).find(
        ([candidateTarget, candidateDirectory]) =>
          candidateTarget !== target && path.resolve(projectRoot, candidateDirectory) === resolved,
      );

      if (otherCanonical) {
        throw new Error(
          `${target} Web Target output directory collides with the ${otherCanonical[0]} canonical artifact: ${resolved}`,
        );
      }
      for (const candidate of new Set([expected, resolved])) {
        if (containsPath(candidate, projectRoot) || containsPath(candidate, repositoryRoot)) {
          throw new Error(
            `${target} Web Target output directory must not be the project, repository, or one of their ancestors: ${candidate}`,
          );
        }
        if (
          (containsPath(projectRoot, candidate) || containsPath(repositoryRoot, candidate)) &&
          candidate !== selectedCanonical
        ) {
          throw new Error(
            `${target} Web Target output inside the project or repository must be its canonical directory ` +
              `${selectedCanonical}, received ${candidate}`,
          );
        }
      }
      if (resolved !== expected) {
        throw new Error(
          `${target} Web Target resolved output directory ${resolved} does not match the selected directory ${expected}`,
        );
      }
    },
  };
}

/** Creates one coherent Vite configuration for the selected compile-time Web Target. */
export function createWebTargetViteConfig({
  command,
  mode,
  environment,
}: WebTargetViteConfigRequest): UserConfig {
  /** Provides profile behavior. */
  const profile = resolveWebTarget(mode);
  /** Platform-owned HTML, environment and dependency resolution root. */
  const targetRoot = fileURLToPath(new URL(`../../../platforms/web/${profile.id}/`, import.meta.url));
  /** Provides upload sentry source maps behavior. */
  const uploadSentrySourceMaps = environment.SENTRY_UPLOAD_SOURCEMAPS === "1";

  /** Provides jest build out dir behavior. */
  const jestBuildOutDir = environment.JEST_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.jest;
  /** Builds output directories. */
  const buildOutputDirectories: Readonly<Record<WebTarget, string>> = {
    jest: jestBuildOutDir,
  };
  /** Provides selected build out dir behavior. */
  const selectedBuildOutDir = path.resolve(portalPackageDirectory, buildOutputDirectories[profile.id]);
  /** Provides sentry build environment behavior. */
  const sentryBuildEnvironment = {
    authToken: environment.SENTRY_AUTH_TOKEN,
    org: environment.SENTRY_ORG,
    project: environment.SENTRY_PROJECT,
    release: environment.SENTRY_RELEASE,
  };
  if (uploadSentrySourceMaps) {
    /** Provides missing behavior. */
    const missing = Object.entries(sentryBuildEnvironment)
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Private Sentry source-map upload requires: ${missing.join(", ")}`);
    }
  }

  /** Provides plugins behavior. */
  const plugins: PluginOption[] = [
    webTargetBuildContractPlugin(profile.id, selectedBuildOutDir),
    targetHtmlPlugin(profile, targetRoot),
    webTargetDependencyPlugin(profile.id),
    jestShaderIndentationPlugin(),
    jestFirebaseScriptPolicyPlugin(),
    react(),
    babel({presets: [reactCompilerPreset()]}),
  ];
  if (uploadSentrySourceMaps) {
    plugins.push(sentryVitePlugin({
      authToken: sentryBuildEnvironment.authToken,
      org: sentryBuildEnvironment.org,
      project: sentryBuildEnvironment.project,
      telemetry: false,
      sourcemaps: {
        assets: `${selectedBuildOutDir}/**`,
        filesToDeleteAfterUpload: `${selectedBuildOutDir}/**/*.map`,
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
    root: targetRoot,
    base: "./",
    devtools: command === "serve",
    define: {
      "import.meta.env.VITE_PLATFORM_TARGET": JSON.stringify(profile.id),
      // Error-only targets do not ship tracing or SDK debug instrumentation.
      __SENTRY_DEBUG__: "false",
      __SENTRY_TRACING__: "false",
    },
    envDir: targetRoot,
    envPrefix: "VITE_",
    plugins,
    publicDir: profile.publicDirectory === false ? false : path.join(portalPackageDirectory, profile.publicDirectory),
    server: {
      fs: {allow: [fileURLToPath(new URL("../../..", import.meta.url))]},
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ["warn", "error"],
      },
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      tsconfigPaths: true,
      alias: {
        "#shop-modal-page": profile.shopEntry,
      },
    },
    build: {
      emptyOutDir: true,
      outDir: selectedBuildOutDir,
      sourcemap: uploadSentrySourceMaps ? "hidden" : false,
      chunkSizeWarningLimit: 450,
      modulePreload: profile.disableModulePreloadPolyfill ? {polyfill: false} : undefined,
      rolldownOptions: {
        input: profile.input,
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
              {
                name: "core-bridge-constants",
                test: /[\/]src[\/]platform[\/]bridge[\/]constants\.ts$/,
                priority: 15,
              },
              {name: "core-game", test: (id: string) => gameRuleSources.has(id.split("?", 1)[0]), priority: 10},
            ],
          },
        },
      },
    },
  };
}
