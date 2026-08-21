import {defineConfig, type Plugin, type PluginOption} from "vite";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {sentryVitePlugin} from "@sentry/vite-plugin";
import {fileURLToPath, URL} from "node:url";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const portalEnvironmentDirectory = fileURLToPath(new URL("../../config/vite/portal/", import.meta.url));
const facebookPlatformEntry = fileURLToPath(new URL("./src/facebook/FacebookPlatformEntry.tsx", import.meta.url));
const jestPlatformEntry = fileURLToPath(new URL("./src/platform/PlatformEntry.tsx", import.meta.url));
const redditPlatformEntry = fileURLToPath(new URL("./src/reddit/RedditPlatformEntry.tsx", import.meta.url));
const sharedShopModalPage = fileURLToPath(new URL("./src/play/modalPages/commerce/ShopModalPage.tsx", import.meta.url));
const redditShopModalPage = fileURLToPath(new URL("./src/reddit/RedditShopModalPage.tsx", import.meta.url));
const youtubeHtmlEntry = fileURLToPath(new URL("./youtube.html", import.meta.url));
const youtubeReleaseContent = fileURLToPath(
  new URL("./src/youtube/generated/youtube-content-v1.json", import.meta.url),
);
const youtubeFixtureContent = fileURLToPath(
  new URL("../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json", import.meta.url),
);
const youtubeForbiddenPlatformEntry = "virtual:youtube-forbidden-platform-entry";
const youtubeForbiddenShopEntry = "virtual:youtube-forbidden-shop-entry";
const youtubeLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi", "zh",
] as const;

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
      if (source === youtubeForbiddenPlatformEntry || source === youtubeForbiddenShopEntry) return `\0${source}`;
      return null;
    },
    load(id) {
      if (id === `\0${youtubeForbiddenPlatformEntry}` || id === `\0${youtubeForbiddenShopEntry}`) {
        throw new Error("YouTube entry imported an unsupported shared platform or commerce module");
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
      handler(_options, bundle) {
        const htmlEntry = Object.entries(bundle).find(([, output]) =>
          output.type === "asset" && output.fileName === "youtube.html"
        );
        if (!htmlEntry) throw new Error("YouTube build did not emit its dedicated HTML entry");
        const [, output] = htmlEntry;
        output.fileName = "index.html";
        this.emitFile({type: "asset", fileName: "youtube-content-manifest.json", source: contentManifest});
      },
    },
  };
}

function facebookArtifactPlugin(): Plugin {
  return {
    name: "riddle-quest-facebook-artifact",
    transformIndexHtml(html) {
      return html
        .replace('content="Play Riddle Quest on Jest"', 'content="Play Riddle Quest on Facebook"')
        .replace(
          '<script async src="https://cdn.jest.com/sdk/latest/jestsdk.js"></script>',
          '<script src="https://connect.facebook.net/en_US/fbinstant.8.0.js"></script>',
        );
    },
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
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace('content="Play Riddle Quest on Jest"', 'content="Play Riddle Quest on Reddit"')
          .replace('    <script async src="https://cdn.jest.com/sdk/latest/jestsdk.js"></script>\n', "")
          .replace('/src/main.tsx', '/src/reddit/main.tsx');
      },
    },
  };
}

export default defineConfig(({command, mode}) => {
  const facebookBuild = mode === "facebook";
  const redditBuild = mode === "reddit";
  const youtubeBuild = mode === "youtube";
  if (command === "build" && !["jest", "facebook", "reddit", "youtube"].includes(mode)) {
    throw new Error(`Unknown production web target mode: ${mode}`);
  }
  const allowYouTubeFixture = youtubeBuild && process.env.YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE === "1";
  const youtubeContent = allowYouTubeFixture ? youtubeFixtureContent : youtubeReleaseContent;
  const uploadSentrySourceMaps = process.env.SENTRY_UPLOAD_SOURCEMAPS === "1";
  if (youtubeBuild && uploadSentrySourceMaps) {
    throw new Error("Sentry source-map upload is forbidden for the self-contained YouTube artifact");
  }
  const jestBuildOutDir = process.env.JEST_BUILD_OUT_DIR?.trim() || "dist-jest";
  const platformBuildOutDir = facebookBuild
    ? process.env.FACEBOOK_BUILD_OUT_DIR?.trim() || "dist-facebook"
    : redditBuild
      ? process.env.REDDIT_BUILD_OUT_DIR?.trim() || "dist-reddit"
      : youtubeBuild
        ? process.env.YOUTUBE_BUILD_OUT_DIR?.trim() || "dist-youtube"
        : jestBuildOutDir;
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

  const plugins: PluginOption[] = [react(), babel({presets: [reactCompilerPreset()]})];
  if (facebookBuild) plugins.push(facebookArtifactPlugin());
  if (redditBuild) plugins.push(redditArtifactPlugin());
  if (youtubeBuild) plugins.push(youtubeArtifactPlugin(youtubeContent, allowYouTubeFixture));
  if (uploadSentrySourceMaps) {
    plugins.push(sentryVitePlugin({
      authToken: sentryBuildEnvironment.authToken,
      org: sentryBuildEnvironment.org,
      project: sentryBuildEnvironment.project,
      telemetry: false,
      sourcemaps: facebookBuild ? {
        assets: `${platformBuildOutDir}/**`,
        filesToDeleteAfterUpload: `${platformBuildOutDir}/**/*.map`,
      } : {
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
    base: mode === "jest" || facebookBuild || redditBuild || youtubeBuild ? "./" : "/riddle-quest/",
    devtools: command === "serve",
    envDir: portalEnvironmentDirectory,
    envPrefix: "VITE_",
    plugins,
    publicDir: youtubeBuild ? false : "public",
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ["warn", "error"],
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "#platform-entry": facebookBuild
          ? facebookPlatformEntry
          : redditBuild
            ? redditPlatformEntry
            : youtubeBuild
              ? youtubeForbiddenPlatformEntry
              : jestPlatformEntry,
        "#shop-modal-page": youtubeBuild
          ? youtubeForbiddenShopEntry
          : redditBuild ? redditShopModalPage : sharedShopModalPage,
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
      outDir: youtubeBuild ? process.env.YOUTUBE_BUILD_OUT_DIR?.trim() || "dist-youtube" : "dist",
      sourcemap: uploadSentrySourceMaps ? "hidden" : false,
      chunkSizeWarningLimit: 450,
      modulePreload: youtubeBuild ? {polyfill: false} : undefined,
      rolldownOptions: {
        input: youtubeBuild
          ? youtubeHtmlEntry
          : redditBuild ? {
            game: fileURLToPath(new URL("./index.html", import.meta.url)),
            splash: fileURLToPath(new URL("./reddit-inline.html", import.meta.url)),
          } : undefined,
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
