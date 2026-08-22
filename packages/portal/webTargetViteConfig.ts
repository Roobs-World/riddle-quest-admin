import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {sentryVitePlugin} from "@sentry/vite-plugin";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, URL} from "node:url";
import type {ConfigEnv, Plugin, PluginOption, UserConfig} from "vite";

const portalEnvironmentDirectory = fileURLToPath(new URL("../../config/vite/portal/", import.meta.url));
const portalPackageDirectory = fileURLToPath(new URL("./", import.meta.url));
const sharedShopModalPage = fileURLToPath(new URL("./src/play/modalPages/commerce/ShopModalPage.tsx", import.meta.url));
const redditShopModalPage = fileURLToPath(new URL("./src/reddit/RedditShopModalPage.tsx", import.meta.url));
const jestHtmlEntry = fileURLToPath(new URL("./targets/jest/index.html", import.meta.url));
const facebookHtmlEntry = fileURLToPath(new URL("./targets/facebook/index.html", import.meta.url));
const redditHtmlEntry = fileURLToPath(new URL("./targets/reddit/index.html", import.meta.url));
const redditInlineHtmlEntry = fileURLToPath(new URL("./targets/reddit/reddit-inline.html", import.meta.url));
const youtubeHtmlEntry = fileURLToPath(new URL("./targets/youtube/index.html", import.meta.url));
const youtubeReleaseContent = fileURLToPath(
  new URL("./src/youtube/generated/youtube-content-v1.json", import.meta.url),
);
const youtubeFixtureContent = fileURLToPath(
  new URL("../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json", import.meta.url),
);
const youtubeForbiddenShopEntry = "virtual:youtube-forbidden-shop-entry";
const youtubeLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi", "zh",
] as const;

/** The four compile-time Web Targets shipped by the portal package. */
export type WebTarget = "jest" | "facebook" | "reddit" | "youtube";

const canonicalBuildOutputDirectories: Readonly<Record<WebTarget, string>> = Object.freeze({
  jest: "dist-jest",
  facebook: "dist-facebook",
  reddit: "dist-reddit",
  youtube: "dist-youtube",
});

/** Input to the single Web Target build-configuration interface. */
export type WebTargetViteConfigRequest = Readonly<{
  command: ConfigEnv["command"];
  mode: string;
  environment: Readonly<Record<string, string | undefined>>;
}>;

type YouTubeContentDocument = {
  schemaVersion?: unknown;
  contentVersion?: unknown;
  releaseReady?: unknown;
  fixture?: unknown;
  locales?: unknown;
  classicOrder?: unknown;
  dailySchedule?: {segments?: unknown};
};

type ValidatedYouTubeContentDocument = YouTubeContentDocument & {
  schemaVersion: 1;
  contentVersion: string;
  releaseReady: boolean;
  fixture: boolean;
  locales: string[];
  classicOrder: string[];
  dailySchedule: {segments: Array<{startsOn: string; canonicalIds: string[]}>};
};

type WebTargetPluginContext = Readonly<{
  allowYouTubeFixture: boolean;
  youtubeContent: string;
}>;

type WebTargetProfile = Readonly<{
  id: WebTarget;
  shopEntry: string;
  publicDirectory: "public" | false;
  input: string | Readonly<Record<string, string>>;
  htmlOutputs: readonly [Readonly<{source: string; fileName: string}>, ...Readonly<{source: string; fileName: string}>[]];
  disableModulePreloadPolyfill?: boolean;
  createArtifactPlugins(context: WebTargetPluginContext): readonly PluginOption[];
}>;

function readYouTubeContentDocument(contentPath: string, allowFixture: boolean) {
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
      typeof (segment as {startsOn?: unknown}).startsOn === "string" &&
      Array.isArray((segment as {canonicalIds?: unknown}).canonicalIds) &&
      (segment as {canonicalIds: unknown[]}).canonicalIds.every((value) => typeof value === "string")
    )
  ) {
    throw new Error("YouTube content does not match the v1 runtime contract");
  }
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

function youtubeArtifactPlugin(contentPath: string, allowFixture: boolean): Plugin {
  let contentManifest: string;
  return {
    name: "riddle-quest-youtube-artifact",
    resolveId(source) {
      if (source === youtubeForbiddenShopEntry) return `\0${source}`;
      return null;
    },
    load(id) {
      if (id === `\0${youtubeForbiddenShopEntry}`) {
        throw new Error("YouTube entry imported an unsupported shared commerce module");
      }
      return null;
    },
    buildStart() {
      const {document, source} = readYouTubeContentDocument(contentPath, allowFixture);
      contentManifest = `${JSON.stringify({
        schemaVersion: 1,
        target: "youtube-playables",
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
      handler() {
        this.emitFile({type: "asset", fileName: "youtube-content-manifest.json", source: contentManifest});
      },
    },
  };
}

function facebookArtifactPlugin(): Plugin {
  return {
    name: "riddle-quest-facebook-artifact",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "fbapp-config.json",
        source: `${JSON.stringify({
          instant_games: {
            platform_version: "8.0",
            orientation: "both",
            navigation_menu_version: "NAV_2",
          },
        }, null, 2)}\n`,
      });
    },
  };
}

function redditArtifactPlugin(): Plugin {
  return {
    name: "riddle-quest-reddit-artifact",
    enforce: "pre",
    load(id) {
      const filename = id.split("?", 1)[0];
      if (!/[\\/]src[\\/]locales[\\/][^\\/]+[\\/]shop\.json$/u.test(filename)) return null;
      const catalog = JSON.parse(readFileSync(filename, "utf8")) as {CoinShop?: Record<string, unknown>};
      const shop = catalog.CoinShop ?? {};
      return JSON.stringify({CoinShop: Object.fromEntries([
        "COINS_SUFFIX", "LOADING_TEXT", "NO_PACKS_AVAILABLE", "PURCHASE_BUTTON", "TITLE", "YOUR_BALANCE",
      ].flatMap((key) => key in shop ? [[key, shop[key]]] : []))});
    },
  };
}

function normalizeOutputPath(value: string): string {
  return value.split(path.sep).join("/");
}

/** Keeps target-owned source documents while presenting the artifact names each host requires. */
function targetHtmlPlugin(profile: WebTargetProfile): Plugin {
  return {
    name: "riddle-quest-web-target-html",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split("?", 1)[0];
        if (requestPath !== "/" && requestPath !== "/index.html") {
          next();
          return;
        }
        response.statusCode = 302;
        response.setHeader(
          "Location",
          `/${normalizeOutputPath(path.relative(portalPackageDirectory, profile.htmlOutputs[0].source))}`,
        );
        response.end();
      });
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const htmlOutput of profile.htmlOutputs) {
          const sourceFileName = normalizeOutputPath(path.relative(portalPackageDirectory, htmlOutput.source));
          const candidates = Object.values(bundle).filter((output) =>
            output.type === "asset" && normalizeOutputPath(output.fileName) === sourceFileName
          );
          if (candidates.length !== 1) {
            throw new Error(
              `${profile.id} Web Target build expected one ${sourceFileName} HTML asset, found ${candidates.length}`,
            );
          }
          const [output] = candidates;
          if (output.type !== "asset" || typeof output.source !== "string") {
            throw new Error(`${profile.id} Web Target HTML output was not a text asset`);
          }
          const sourceDirectory = path.posix.dirname(sourceFileName);
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
});

function isWebTarget(mode: string): mode is WebTarget {
  return Object.hasOwn(targetProfiles, mode);
}

function resolveWebTarget(mode: string): WebTargetProfile {
  if (isWebTarget(mode)) return targetProfiles[mode];
  throw new Error(`Unknown Web Target mode: ${mode}; expected jest, facebook, reddit, or youtube`);
}

function containsPath(root: string, candidate: string): boolean {
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
    configResolved(config) {
      const projectRoot = path.resolve(config.root);
      const repositoryRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const expected = path.resolve(projectRoot, expectedOutDir);
      const resolved = path.resolve(projectRoot, config.build.outDir);
      const selectedCanonical = path.resolve(projectRoot, canonicalBuildOutputDirectories[target]);
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
  const profile = resolveWebTarget(mode);
  const allowYouTubeFixture = environment.YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE === "1";
  if (allowYouTubeFixture && profile.id !== "youtube") {
    throw new Error("The YouTube engineering content fixture can only be used with the youtube Web Target");
  }
  const youtubeContent = allowYouTubeFixture ? youtubeFixtureContent : youtubeReleaseContent;
  const uploadSentrySourceMaps = environment.SENTRY_UPLOAD_SOURCEMAPS === "1";
  if (profile.id === "youtube" && uploadSentrySourceMaps) {
    throw new Error("Sentry source-map upload is forbidden for the self-contained YouTube artifact");
  }

  const jestBuildOutDir = environment.JEST_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.jest;
  const buildOutputDirectories: Readonly<Record<WebTarget, string>> = {
    jest: jestBuildOutDir,
    facebook: environment.FACEBOOK_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.facebook,
    reddit: environment.REDDIT_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.reddit,
    youtube: environment.YOUTUBE_BUILD_OUT_DIR?.trim() || canonicalBuildOutputDirectories.youtube,
  };
  const selectedBuildOutDir = buildOutputDirectories[profile.id];
  const sentryBuildEnvironment = {
    authToken: environment.SENTRY_AUTH_TOKEN,
    org: environment.SENTRY_ORG,
    project: environment.SENTRY_PROJECT,
    release: environment.SENTRY_RELEASE,
  };
  if (uploadSentrySourceMaps) {
    const missing = Object.entries(sentryBuildEnvironment)
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Private Sentry source-map upload requires: ${missing.join(", ")}`);
    }
  }

  const plugins: PluginOption[] = [
    webTargetBuildContractPlugin(profile.id, selectedBuildOutDir),
    targetHtmlPlugin(profile),
    react(),
    babel({presets: [reactCompilerPreset()]}),
    ...profile.createArtifactPlugins({allowYouTubeFixture, youtubeContent}),
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
    base: "./",
    devtools: command === "serve",
    define: {
      "import.meta.env.VITE_PLATFORM_TARGET": JSON.stringify(profile.id),
    },
    envDir: portalEnvironmentDirectory,
    envPrefix: "VITE_",
    plugins,
    publicDir: profile.publicDirectory,
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ["warn", "error"],
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "#shop-modal-page": profile.shopEntry,
        "#youtube-content": youtubeContent,
        "@qwordly/core/bridge/constants": fileURLToPath(new URL("../core/src/bridge/constants.ts", import.meta.url)),
        "@qwordly/core/bridge": fileURLToPath(new URL("../core/src/bridge/index.ts", import.meta.url)),
        "@qwordly/core/pricing/catalog": fileURLToPath(new URL("../core/src/pricing/catalog.ts", import.meta.url)),
        "@qwordly/core/pricing/redditCatalog": fileURLToPath(new URL("../core/src/pricing/redditCatalog.ts", import.meta.url)),
        "@qwordly/core/race": fileURLToPath(new URL("../core/src/race/index.ts", import.meta.url)),
        "@qwordly/core/referrals": fileURLToPath(new URL("../core/src/referrals/index.ts", import.meta.url)),
        "@qwordly/core/validation": fileURLToPath(new URL("../core/src/validation/index.ts", import.meta.url)),
        "@qwordly/core/game": fileURLToPath(new URL("../core/src/game/index.ts", import.meta.url)),
        "@qwordly/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      },
    },
    build: {
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
}
