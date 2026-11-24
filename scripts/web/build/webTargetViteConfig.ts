import {jestShaderIndentationPlugin, jestFirebaseScriptPolicyPlugin} from "../../../platforms/web/jest/tooling/jestArtifactPlugins.ts";
import {redditArtifactPlugin} from "../../../platforms/web/reddit/tooling/redditArtifactPlugin.ts";
import {facebookArtifactPlugin} from "../../../platforms/web/facebook/tooling/facebookArtifactPlugin.ts";
import {webBuildFacts} from "../../release/release-registry.mjs";
import {playableContentModule, playableContentPlugin} from "./playableContentPlugin.ts";
import {webTargetDependencyPlugin} from "./webTargetDependencies.ts";
import {hostedNotificationsPlugin} from "./hostedNotificationsPlugin.ts";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {sentryVitePlugin} from "@sentry/vite-plugin";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
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
/** Provides reddit shop modal page behavior. */
const redditShopModalPage = fileURLToPath(new URL("../../../platforms/web/reddit/src/RedditShopModalPage.tsx", import.meta.url));
/** Provides jest html entry behavior. */
const jestHtmlEntry = fileURLToPath(new URL("../../../platforms/web/jest/index.html", import.meta.url));
/** Provides facebook html entry behavior. */
const facebookHtmlEntry = fileURLToPath(new URL("../../../platforms/web/facebook/index.html", import.meta.url));
/** Provides reddit html entry behavior. */
const redditHtmlEntry = fileURLToPath(new URL("../../../platforms/web/reddit/index.html", import.meta.url));
/** Provides reddit inline html entry behavior. */
const redditInlineHtmlEntry = fileURLToPath(new URL("../../../platforms/web/reddit/reddit-inline.html", import.meta.url));
/** Provides youtube html entry behavior. */
const youtubeHtmlEntry = fileURLToPath(new URL("../../../platforms/web/youtube/index.html", import.meta.url));
/** Provides netflix html entry behavior. */
const netflixHtmlEntry = fileURLToPath(new URL("../../../platforms/web/netflix/index.html", import.meta.url));
/** Provides yahoo html entry behavior. */
const yahooHtmlEntry = fileURLToPath(new URL("../../../platforms/web/yahoo/index.html", import.meta.url));
/** Provides GameSnacks html entry behavior. */
const gameSnacksHtmlEntry = fileURLToPath(new URL("../../../platforms/web/gamesnacks/index.html", import.meta.url));
/** Provides youtube release content behavior. */
const youtubeReleaseContent = fileURLToPath(
  new URL("../../../src/content/generated/youtube-content-v1.json", import.meta.url),
);
/** Provides youtube fixture content behavior. */
const youtubeFixtureContent = fileURLToPath(
  new URL("../../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json", import.meta.url),
);
/** Provides youtube forbidden shop entry behavior. */
const youtubeForbiddenShopEntry = "virtual:youtube-forbidden-shop-entry";
/** Provides youtube locales behavior. */
const youtubeLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi",
] as const;

/** The four compile-time Web Targets shipped by the portal package. */
export type WebTarget = "jest" | "facebook" | "reddit" | "youtube" | "netflix" | "yahoo" | "gamesnacks";

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

/** Describes you tube content document. */
type YouTubeContentDocument = {
  /** Stores schema version. */
  schemaVersion?: unknown;
  /** Stores content version. */
  contentVersion?: unknown;
  /** Stores release ready. */
  releaseReady?: unknown;
  /** Stores fixture. */
  fixture?: unknown;
  /** Stores locales. */
  locales?: unknown;
  /** Stores classic order. */
  classicOrder?: unknown;
  /** Stores daily schedule. */
  dailySchedule?: {/** Stores segments. */
  /** Stores segments. */
  segments?: unknown};
};

/** Describes validated you tube content document. */
type ValidatedYouTubeContentDocument = YouTubeContentDocument & {
  /** Stores schema version. */
  schemaVersion: 1;
  /** Stores content version. */
  contentVersion: string;
  /** Stores release ready. */
  releaseReady: boolean;
  /** Stores fixture. */
  fixture: boolean;
  /** Stores locales. */
  locales: string[];
  /** Stores classic order. */
  classicOrder: string[];
  /** Stores daily schedule. */
  dailySchedule: {/** Stores segments. */
  /** Stores segments. */
  segments: Array<{/** Stores starts on. */
  /** Stores starts on. */
  startsOn: string; /** Stores canonical ids. */
  /** Stores canonical ids. */
  canonicalIds: string[]}>};
};

/** Describes web target plugin context. */
type WebTargetPluginContext = Readonly<{
  /** Stores allow you tube fixture. */
  allowYouTubeFixture: boolean;
  /** Stores youtube content. */
  youtubeContent: string;
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
  createArtifactPlugins(context: WebTargetPluginContext): readonly PluginOption[];
}>;

/** Reads you tube content document. */
function readYouTubeContentDocument(contentPath: string, allowFixture: boolean) {
  /** Provides source behavior. */
  let source: string;
  try {
    source = readFileSync(contentPath, "utf8");
  } catch (error) {
    throw new Error(
      allowFixture
        ? "YouTube engineering content fixture is missing; regenerate the committed fixture"
        : "YouTube release content is missing; generate and audit all 17 locale packs before building",
      {cause: error},
    );
  }
  /** Provides document behavior. */
  let document: YouTubeContentDocument;
  try {
    document = JSON.parse(source) as YouTubeContentDocument;
  } catch (error) {
    throw new Error("YouTube content is not valid JSON", {cause: error});
  }
  if (
    document.schemaVersion !== 1 ||
    typeof document.contentVersion !== "string" ||
    document.contentVersion.length < 1 ||
    !Array.isArray(document.locales) ||
    !document.locales.every((value) => typeof value === "string") ||
    !Array.isArray(document.classicOrder) ||
    !document.classicOrder.every((value) => typeof value === "string") ||
    document.dailySchedule === null ||
    typeof document.dailySchedule !== "object" ||
    !Array.isArray(document.dailySchedule.segments) ||
    document.dailySchedule.segments.length < 1 ||
    !document.dailySchedule.segments.every((segment) =>
      segment !== null && typeof segment === "object" &&
      typeof (segment as {/** Stores starts on. */
      /** Stores starts on. */
      startsOn?: unknown}).startsOn === "string" &&
      Array.isArray((segment as {/** Stores canonical ids. */
      /** Stores canonical ids. */
      canonicalIds?: unknown}).canonicalIds) &&
      (segment as {/** Stores canonical ids. */
      /** Stores canonical ids. */
      canonicalIds: unknown[]}).canonicalIds.every((value) => typeof value === "string")
    )
  ) {
    throw new Error("YouTube content does not match the v1 runtime contract");
  }
  /** Provides locales behavior. */
  const locales = [...document.locales].sort();
  if (allowFixture) {
    if (document.releaseReady !== false || document.fixture !== true || locales.join(",") !== "en") {
      throw new Error("YouTube engineering builds require the explicit non-release English fixture");
    }
  } else if (
    document.releaseReady !== true ||
    document.fixture === true ||
    locales.join(",") !== [...youtubeLocales].sort().join(",")
  ) {
    throw new Error("YouTube release builds require an audited releaseReady pack for all 17 locales");
  }
  return {document: document as ValidatedYouTubeContentDocument, source};
}

/** Provides youtube artifact plugin behavior. */
function youtubeArtifactPlugin(contentPath: string, allowFixture: boolean, target = "youtube-playables"): Plugin {
  /** Provides content manifest behavior. */
  let contentManifest: string;
  return {
    name: "riddle-quest-youtube-artifact",
    /** Resolves id. */
    resolveId(source) {
      if (source === youtubeForbiddenShopEntry) return `\0${source}`;
      return null;
    },
    /** Provides load behavior. */
    load(id) {
      if (id === `\0${youtubeForbiddenShopEntry}`) {
        throw new Error("YouTube entry imported an unsupported shared commerce module");
      }
      return null;
    },
    /** Builds start. */
    buildStart() {
      /** Provides {document, source} behavior. */
      const {document, source} = readYouTubeContentDocument(contentPath, allowFixture);
      contentManifest = `${JSON.stringify({
        schemaVersion: 1,
        target,
        contentVersion: document.contentVersion,
        contentSha256: createHash("sha256").update(source).digest("hex"),
        releaseReady: document.releaseReady,
        fixture: document.fixture === true,
        locales: document.locales,
        classicRiddleCount: document.classicOrder.length,
        dailyScheduleEntries: document.dailySchedule.segments.reduce(
          (count, segment) => count + segment.canonicalIds.length,
          0,
        ),
      }, null, 2)}\n`;
    },
    generateBundle: {
      order: "post",
      /** Provides handler behavior. */
      handler() {
        this.emitFile({type: "asset", fileName: "youtube-content-manifest.json", source: contentManifest});
      },
    },
  };
}

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
  facebook: Object.freeze({
    id: "facebook",
    shopEntry: sharedShopModalPage,
    publicDirectory: "public",
    input: facebookHtmlEntry,
    htmlOutputs: Object.freeze([{source: facebookHtmlEntry, fileName: "index.html"}] as const),
    createArtifactPlugins: () => [facebookArtifactPlugin()],
  }),
  reddit: Object.freeze({
    id: "reddit",
    shopEntry: redditShopModalPage,
    publicDirectory: "public",
    input: Object.freeze({game: redditHtmlEntry, splash: redditInlineHtmlEntry}),
    htmlOutputs: Object.freeze([
      {source: redditHtmlEntry, fileName: "index.html"},
      {source: redditInlineHtmlEntry, fileName: "reddit-inline.html"},
    ] as const),
    createArtifactPlugins: () => [redditArtifactPlugin()],
  }),
  youtube: Object.freeze({
    id: "youtube",
    shopEntry: youtubeForbiddenShopEntry,
    publicDirectory: false,
    input: youtubeHtmlEntry,
    htmlOutputs: Object.freeze([{source: youtubeHtmlEntry, fileName: "index.html"}] as const),
    disableModulePreloadPolyfill: true,
    createArtifactPlugins: ({allowYouTubeFixture, youtubeContent}: WebTargetPluginContext) => [
      youtubeArtifactPlugin(youtubeContent, allowYouTubeFixture),
    ],
  }),
  netflix: Object.freeze({
    id: "netflix",
    shopEntry: youtubeForbiddenShopEntry,
    publicDirectory: false,
    input: netflixHtmlEntry,
    htmlOutputs: Object.freeze([{source: netflixHtmlEntry, fileName: "index.html"}] as const),
    disableModulePreloadPolyfill: true,
    createArtifactPlugins: ({allowYouTubeFixture, youtubeContent}: WebTargetPluginContext) => [
      youtubeArtifactPlugin(youtubeContent, allowYouTubeFixture, "netflix-candidate"),
    ],
  }),
  yahoo: Object.freeze({
    id: "yahoo",
    shopEntry: youtubeForbiddenShopEntry,
    publicDirectory: false,
    input: yahooHtmlEntry,
    htmlOutputs: Object.freeze([{source: yahooHtmlEntry, fileName: "index.html"}] as const),
    disableModulePreloadPolyfill: true,
    createArtifactPlugins: ({allowYouTubeFixture, youtubeContent}: WebTargetPluginContext) => [
      youtubeArtifactPlugin(youtubeContent, allowYouTubeFixture, "yahoo-candidate"),
    ],
  }),
  gamesnacks: Object.freeze({
    id: "gamesnacks",
    shopEntry: youtubeForbiddenShopEntry,
    publicDirectory: false,
    input: gameSnacksHtmlEntry,
    htmlOutputs: Object.freeze([{source: gameSnacksHtmlEntry, fileName: "index.html"}] as const),
    disableModulePreloadPolyfill: true,
    createArtifactPlugins: ({allowYouTubeFixture, youtubeContent}: WebTargetPluginContext) => [
      youtubeArtifactPlugin(youtubeContent, allowYouTubeFixture, "gamesnacks"),
    ],
  }),
});

/** Indicates whether is web target. */
function isWebTarget(mode: string): mode is WebTarget {
  return Object.hasOwn(targetProfiles, mode);
}

/** Resolves web target. */
function resolveWebTarget(mode: string): WebTargetProfile {
  if (isWebTarget(mode)) return targetProfiles[mode];
  throw new Error(`Unknown Web Target mode: ${mode}; expected jest, facebook, reddit, youtube, netflix, yahoo, or gamesnacks`);
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
  /** Provides allow you tube fixture behavior. */
  const allowYouTubeFixture = environment.YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE === "1";
  if (allowYouTubeFixture && !["youtube", "netflix"].includes(profile.id)) {
    throw new Error("The bundled engineering content fixture can only be used with a self-contained Web Target");
  }
  /** Provides youtube content behavior. */
  const youtubeContent = allowYouTubeFixture ? youtubeFixtureContent : youtubeReleaseContent;
  /** Provides upload sentry source maps behavior. */
  const uploadSentrySourceMaps = environment.SENTRY_UPLOAD_SOURCEMAPS === "1";
  if (["youtube", "netflix", "yahoo", "gamesnacks"].includes(profile.id) && uploadSentrySourceMaps) {
    throw new Error("Sentry source-map upload is forbidden for self-contained artifacts");
  }

  /** Provides jest build out dir behavior. */
  const jestBuildOutDir = environment.JEST_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.jest;
  /** Builds output directories. */
  const buildOutputDirectories: Readonly<Record<WebTarget, string>> = {
    jest: jestBuildOutDir,
    facebook: environment.FACEBOOK_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.facebook,
    reddit: environment.REDDIT_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.reddit,
    youtube: environment.YOUTUBE_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.youtube,
    netflix: environment.NETFLIX_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.netflix,
    yahoo: environment.YAHOO_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.yahoo,
    gamesnacks: environment.GAMESNACKS_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.gamesnacks,
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
    hostedNotificationsPlugin(profile.id),
    webTargetDependencyPlugin(profile.id),
    ...(profile.id === "jest" ? [jestShaderIndentationPlugin(), jestFirebaseScriptPolicyPlugin()] : []),
    react(),
    babel({presets: [reactCompilerPreset()]}),
    ...profile.createArtifactPlugins({allowYouTubeFixture, youtubeContent}),
    ...(["youtube", "netflix", "yahoo", "gamesnacks"].includes(profile.id) ? [playableContentPlugin(youtubeContent)] : []),
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
      ...(["jest", "facebook"].includes(profile.id) ? {__SENTRY_DEBUG__: "false", __SENTRY_TRACING__: "false"} : {}),
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
        ...(profile.id === "jest" ? {"./localeModules": fileURLToPath(new URL("../../../platforms/web/jest/src/localeModules.ts", import.meta.url))} : {}),
        "#shop-modal-page": profile.shopEntry,
        "#youtube-content": ["youtube", "netflix", "yahoo", "gamesnacks"].includes(profile.id) ? playableContentModule : youtubeContent,
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
          ...(profile.id === "gamesnacks" ? {
            entryFileNames: "assets/[name].js",
            chunkFileNames: "assets/[name].js",
            assetFileNames: "assets/[name][extname]",
          } : {}),
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
