import assert from "node:assert/strict";
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {inspectWebTargetArtifact} from "./web-target-artifact-inventory.mjs";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));
const repositoryDirectory = path.resolve(packageDirectory);
const platformDirectory = target => path.join(repositoryDirectory, "platforms/web", target);
const jestAudit = path.join(platformDirectory("jest"), "scripts/audit-jest-artifact.mjs");
const facebookAudit = path.join(platformDirectory("facebook"), "scripts/audit-facebook-artifact.mjs");
const redditAudit = path.join(platformDirectory("reddit"), "scripts/audit-reddit-artifact.mjs");
const youtubeAudit = path.join(platformDirectory("youtube"), "scripts/audit-youtube-artifact.mjs");
const standaloneAudit = path.join(packageDirectory, "scripts/web/audit-standalone-artifact.mjs");
const targetName = (platform) => platform === "youtube"
  ? "YouTube"
  : platform[0].toUpperCase() + platform.slice(1);

const runAudit = (script, directory, extraArguments = []) => spawnSync(process.execPath, [script, directory, ...extraArguments], {
  cwd: packageDirectory,
  encoding: "utf8",
});

const runPlatformAudit = (platform, directory) => {
  if (platform === "jest") return runAudit(jestAudit, directory);
  if (platform === "facebook") return runAudit(facebookAudit, directory);
  if (platform === "reddit") return runAudit(redditAudit, directory);
  return runAudit(youtubeAudit, directory, ["--allow-incomplete-fixture"]);
};

const pluginNames = (plugins) => plugins.flat(Infinity)
  .filter((plugin) => plugin && typeof plugin === "object" && typeof plugin.name === "string")
  .map((plugin) => plugin.name);

const runBuildContract = (config, {
  root = config.root,
  outDir = config.build.outDir,
} = {}) => {
  const plugin = config.plugins.flat(Infinity).find(
    (candidate) => candidate?.name === "riddle-quest-web-target-build-contract",
  );
  assert.ok(plugin, "Web Target build contract plugin is missing");
  assert.equal(plugin.apply, "build");
  assert.equal(plugin.enforce, "pre");
  assert.equal(typeof plugin.configResolved, "function");
  plugin.configResolved({root, build: {outDir}});
};

test("Jest bundles English copy without other targets' locale chunks", async () => {
  /** The actual translation module must lose unreachable locale imports during production bundling. */
  const {build} = await import("vite");
  /** Target aliases prevent unsupported catalogs from entering the module graph. */
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const target of ["jest", "facebook"]) {
    /** Production target policy is shared with this in-memory translation build. */
    const targetConfig = createWebTargetViteConfig({command: "build", mode: target, environment: {}});
    /** In-memory builds inspect target elimination without replacing any game artifacts. */
    const result = await build({
      root: packageDirectory,
      configFile: false,
      publicDir: false,
      logLevel: "silent",
      define: targetConfig.define,
      resolve: targetConfig.resolve,
      build: {
        write: false,
        emptyOutDir: false,
        lib: {entry: path.join(packageDirectory, "src/localization/browser/i18n.ts"), formats: ["es"]},
        rolldownOptions: {external: ["react"]},
      },
    });
    /** Emitted modules distinguish eliminated imports from merely hidden language controls. */
    const modules = (Array.isArray(result) ? result : [result]).flatMap(({output}) => output
      .filter(({type}) => type === "chunk")
      .flatMap(({modules}) => Object.keys(modules).map(id => id.replaceAll("\\", "/"))));
    assert.ok(modules.some(id => id.endsWith("/src/locales/en/settings.json")), target);
    if (target === "jest") {
      assert.equal(modules.some(id => /\/src\/locales\/(?!en\/)/u.test(id)), false);
      assert.equal(modules.some(id => id.endsWith("/src/localization/browser/localeModules.ts")), false);
    } else {
      assert.ok(modules.some(id => id.endsWith("/src/locales/fr/settings.json")));
      assert.ok(modules.some(id => id.endsWith("/src/localization/browser/localeModules.ts")));
    }
  }
});

test("Jest omits unused Firebase products while retaining every supported script URL and version mapping", async () => {
  /** The installed SDK supplies the reviewed declaration and actual URL validation behavior. */
  const require = createRequire(import.meta.url);
  /** Resolve the app package through the same Firebase version used by the portal. */
  const app = createRequire(require.resolve("firebase/app")).resolve("@firebase/app");
  /** Actual vendor source ensures a dependency update cannot silently bypass this boundary. */
  const source = await readFile(app, "utf8");
  /** Production target configuration owns the narrowing transform. */
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  /** Select the target-only plugin without replacing the package or policy implementation. */
  const plugin = createWebTargetViteConfig({command: "build", mode: "jest", environment: {}}).plugins.flat(Infinity)
    .find(candidate => candidate?.name === "riddle-quest-jest-firebase-script-policy");
  assert.ok(plugin);
  /** Only the unused Analytics URL and Crashlytics metadata may disappear from the reviewed SDK. */
  const result = plugin.transform(source, app);
  assert.ok(result);
  /** The SDK's validator executes with its unchanged Auth and App Check entries. */
  const declaration = result.code.match(/const ALLOWED_SCRIPT_URLS = \[[\s\S]*?\n\];/u)?.[0];
  /** This helper is independent of the rest of the Firebase runtime. */
  const validator = result.code.match(/function _createTrustedScriptURL\(url\) \{[\s\S]*?^\}/mu)?.[0];
  assert.ok(declaration);
  assert.ok(validator);
  /** Compare the entire policy so future supported URLs cannot be removed silently. */
  const originalDeclaration = source.match(/const ALLOWED_SCRIPT_URLS = \[[\s\S]*?\n\];/u)?.[0];
  assert.ok(originalDeclaration);
  assert.deepEqual(Array.from(runInNewContext(`${declaration}\nALLOWED_SCRIPT_URLS`)),
    Array.from(runInNewContext(`${originalDeclaration}\nALLOWED_SCRIPT_URLS`))
      .filter(url => url !== "https://www.googletagmanager.com/gtag/js"));
  /** Evaluate only the actual identifier constants and their pure platform-log dictionary. */
  const platformLog = code => {
    /** Product-name declarations supply the dictionary's computed property keys. */
    const names = code.match(/const name[\w$]* = ["'][^"']+["'];/gu) ?? [];
    /** This single dictionary is the only reviewed Crashlytics reference. */
    const registration = code.match(/const PLATFORM_LOG_STRING = \{[\s\S]*?\n\};/u)?.[0];
    assert.ok(registration);
    return Object.fromEntries(Object.entries(runInNewContext(`${names.join("\n")}\n${registration}\nPLATFORM_LOG_STRING`)));
  };
  assert.deepEqual(platformLog(result.code), Object.fromEntries(Object.entries(platformLog(source))
    .filter(([product]) => product !== "@firebase/crashlytics")));
  /** An isolated context evaluates only the actual allowlist and its pure validator. */
  const allow = runInNewContext(`${declaration}\n${validator}\n_createTrustedScriptURL`);
  for (const url of ["https://apis.google.com/js/api.js", "https://www.google.com/recaptcha/api.js", "https://www.google.com/recaptcha/enterprise.js"]) {
    assert.equal(allow(url), url);
    assert.equal(allow(`${url}?key=fixture`), `${url}?key=fixture`);
    assert.throws(() => allow(`${url}.evil.example`), /Refusing to load untrusted script URL/u);
  }
  assert.throws(() => allow("https://www.googletagmanager.com/gtag/js"), /Refusing to load untrusted script URL/u);
  assert.equal(result.code.includes("googletagmanager.com"), false);
  assert.equal(result.code.includes("@firebase/crashlytics"), false);
  assert.equal(plugin.transform(source, app.replace("@firebase/app/", "@firebase/analytics/")), null);
  assert.throws(() => plugin.transform(source.replace("const ALLOWED_SCRIPT_URLS", "const CHANGED_SCRIPT_URLS"), app), /source changed/u);
  assert.throws(() => plugin.transform(source.replace("'fire-cls'", "'changed-fire-cls'"), app), /registration changed/u);
  assert.equal(pluginNames(createWebTargetViteConfig({command: "build", mode: "facebook", environment: {}}).plugins)
    .includes("riddle-quest-jest-firebase-script-policy"), false);
});

test("Vite configuration requires an explicit known Web Target for build and serve", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const command of ["build", "serve"]) {
    assert.throws(
      () => createWebTargetViteConfig({command, mode: "unknown-target", environment: {}}),
      /Unknown Web Target mode: unknown-target; expected jest, facebook, reddit, youtube, netflix, yahoo, or gamesnacks/u,
    );
  }
  assert.throws(
    () => createWebTargetViteConfig({command: "serve", mode: "development", environment: {}}),
    /Unknown Web Target mode: development/u,
  );
});

test("YouTube Vite configuration rejects private Sentry upload configuration", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  assert.throws(
    () => createWebTargetViteConfig({
      command: "build",
      mode: "youtube",
      environment: {
        YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE: "1",
        SENTRY_UPLOAD_SOURCEMAPS: "1",
      },
    }),
    /Sentry source-map upload is forbidden/u,
  );
});

test("the Web Target config resolves one isolated build profile for every release target", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const expectations = {
    jest: {
      outDir: path.join(repositoryDirectory, "builds/jest"),
      htmlEntry: "/platforms/web/jest/index.html",
      shopEntry: "/src/play/modalPages/commerce/ShopModalPage.tsx",
      artifactPlugin: "riddle-quest-jest-challenge-push-worker",
    },
    facebook: {
      outDir: path.join(repositoryDirectory, "builds/facebook"),
      htmlEntry: "/platforms/web/facebook/index.html",
      shopEntry: "/src/play/modalPages/commerce/ShopModalPage.tsx",
      artifactPlugin: "riddle-quest-facebook-artifact",
    },
    reddit: {
      outDir: path.join(repositoryDirectory, "builds/reddit"),
      htmlEntry: undefined,
      shopEntry: "/platforms/web/reddit/src/RedditShopModalPage.tsx",
      artifactPlugin: "riddle-quest-reddit-artifact",
    },
    youtube: {
      outDir: path.join(repositoryDirectory, "builds/youtube"),
      htmlEntry: "/platforms/web/youtube/index.html",
      shopEntry: "virtual:youtube-forbidden-shop-entry",
      artifactPlugin: "riddle-quest-youtube-artifact",
    },
    netflix: {
      outDir: path.join(repositoryDirectory, "builds/netflix"),
      htmlEntry: "/platforms/web/netflix/index.html",
      shopEntry: "virtual:youtube-forbidden-shop-entry",
      artifactPlugin: "riddle-quest-youtube-artifact",
    },
    yahoo: {
      outDir: path.join(repositoryDirectory, "builds/yahoo"),
      htmlEntry: "/platforms/web/yahoo/index.html",
      shopEntry: "virtual:youtube-forbidden-shop-entry",
      artifactPlugin: "riddle-quest-youtube-artifact",
    },
  };

  for (const [mode, expected] of Object.entries(expectations)) {
    const config = createWebTargetViteConfig({command: "build", mode, environment: {}});
    assert.equal(config.base, "./");
    assert.equal(config.define["import.meta.env.VITE_PLATFORM_TARGET"], JSON.stringify(mode));
    if (["jest", "facebook"].includes(mode)) {
      assert.equal(config.define.__SENTRY_DEBUG__, "false");
      assert.equal(config.define.__SENTRY_TRACING__, "false");
    } else {
      assert.equal(Object.hasOwn(config.define, "__SENTRY_DEBUG__"), false);
      assert.equal(Object.hasOwn(config.define, "__SENTRY_TRACING__"), false);
    }
    assert.equal(config.build.outDir, expected.outDir);
    assert.equal(Object.hasOwn(config.resolve.alias, "#platform-entry"), false);
    if (expected.htmlEntry) {
      assert.equal(config.build.rolldownOptions.input.endsWith(expected.htmlEntry), true);
    }
    assert.equal(config.resolve.alias["#shop-modal-page"].endsWith(expected.shopEntry), true);
    const names = pluginNames(config.plugins);
    assert.equal(names.includes("riddle-quest-web-target-build-contract"), true);
    assert.equal(names.includes("riddle-quest-web-target-html"), true);
    if (expected.artifactPlugin) assert.equal(names.includes(expected.artifactPlugin), true);
    else assert.equal(names.some((name) =>
      name.startsWith("riddle-quest-") && ![
        "riddle-quest-web-target-build-contract",
        "riddle-quest-web-target-html",
        "riddle-quest-target-dependencies",
      ].includes(name)
    ), false);
    runBuildContract(config);
  }

  const reddit = createWebTargetViteConfig({command: "build", mode: "reddit", environment: {}});
  assert.deepEqual(Object.keys(reddit.build.rolldownOptions.input).sort(), ["game", "splash"]);
  assert.equal(reddit.build.rolldownOptions.input.game.endsWith("/platforms/web/reddit/index.html"), true);
  assert.equal(reddit.build.rolldownOptions.input.splash.endsWith("/platforms/web/reddit/reddit-inline.html"), true);
  const youtube = createWebTargetViteConfig({command: "build", mode: "youtube", environment: {}});
  assert.equal(youtube.publicDir, false);
  assert.deepEqual(youtube.build.modulePreload, {polyfill: false});
});

test("every target config retains the Jest worker boundary guard", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const workerImport = "virtual:jest-live-challenge-push-worker-url";
  for (const command of ["build", "serve"]) {
    for (const mode of ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"]) {
      const config = createWebTargetViteConfig({command, mode, environment: {}});
      const guards = config.plugins.flat(Infinity).filter(
        plugin => plugin?.name === "riddle-quest-jest-challenge-push-worker",
      );
      assert.equal(guards.length, 1, `${mode}/${command} must retain exactly one worker boundary guard`);
      const guard = guards[0];
      assert.equal(guard.resolveId("unrelated-module"), null);
      if (mode === "jest") {
        assert.equal(guard.resolveId(workerImport), "\0virtual:jest-live-challenge-push-worker-url");
      } else {
        assert.throws(() => guard.resolveId(workerImport), /cannot emit the Jest notification worker/u);
      }
    }
  }
});

test("the private HTML adapter emits host filenames with artifact-root-relative URLs", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const config = createWebTargetViteConfig({command: "build", mode: "reddit", environment: {}});
  const plugin = config.plugins.flat(Infinity).find(
    (candidate) => candidate?.name === "riddle-quest-web-target-html",
  );
  assert.ok(plugin);
  const gameFileName = path.relative(config.root, config.build.rolldownOptions.input.game)
    .split(path.sep).join("/");
  const splashFileName = path.relative(config.root, config.build.rolldownOptions.input.splash)
    .split(path.sep).join("/");
  const bundle = {
    game: {
      type: "asset",
      fileName: gameFileName,
      source: '<script type="module" src="./assets/game.js"></script>',
    },
    splash: {
      type: "asset",
      fileName: splashFileName,
      source: '<script type="module" src="./assets/splash.js"></script>',
    },
  };

  plugin.generateBundle.handler({}, bundle);

  assert.equal(bundle.game.fileName, "index.html");
  assert.equal(bundle.game.source, '<script type="module" src="./assets/game.js"></script>');
  assert.equal(bundle.splash.fileName, "reddit-inline.html");
  assert.equal(bundle.splash.source, '<script type="module" src="./assets/splash.js"></script>');
});

test("one selected output directory drives each Web Target build", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const [mode, environmentName] of [
    ["jest", "JEST_BUILD_OUT_DIR"],
    ["facebook", "FACEBOOK_BUILD_OUT_DIR"],
    ["reddit", "REDDIT_BUILD_OUT_DIR"],
    ["youtube", "YOUTUBE_BUILD_OUT_DIR"],
    ["netflix", "NETFLIX_BUILD_OUT_DIR"],
    ["yahoo", "YAHOO_BUILD_OUT_DIR"],
  ]) {
    const outputDirectory = path.join(tmpdir(), `riddle-quest-${mode}-output`);
    const config = createWebTargetViteConfig({
      command: "build",
      mode,
      environment: {[environmentName]: `  ${outputDirectory}  `},
    });
    assert.equal(config.build.outDir, outputDirectory);
    runBuildContract(config, {outDir: outputDirectory});
  }
});

test("the resolved profile owns runtime target identity despite conflicting ambient configuration", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const config = createWebTargetViteConfig({
    command: "build",
    mode: "facebook",
    environment: {VITE_PLATFORM_TARGET: "reddit"},
  });
  assert.equal(config.define["import.meta.env.VITE_PLATFORM_TARGET"], JSON.stringify("facebook"));

  const packageManifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
  for (const script of ["build:facebook", "build:reddit", "build:youtube", "build:youtube:fixture", "build:netflix", "build:yahoo"]) {
    assert.doesNotMatch(packageManifest.scripts[script], /\bVITE_PLATFORM_TARGET=/u);
  }
  const facebookEnvironment = await readFile(
    path.resolve(packageDirectory, "platforms/web/facebook/.env.facebook"),
    "utf8",
  );
  assert.doesNotMatch(facebookEnvironment, /^VITE_PLATFORM_TARGET=/mu);
});

test("the build contract accepts matching absolute release and harness output directories", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const absoluteJestReleaseDirectory = path.join(tmpdir(), "riddle-quest-jest-release", "artifact");
  const config = createWebTargetViteConfig({
    command: "build",
    mode: "jest",
    environment: {JEST_BUILD_OUT_DIR: absoluteJestReleaseDirectory},
  });
  runBuildContract(config, {outDir: absoluteJestReleaseDirectory});
});

test("the build contract rejects CLI output overrides that differ from the selected directory", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const expected = path.join(tmpdir(), "riddle-quest-jest-release", "expected");
  const actual = path.join(tmpdir(), "riddle-quest-jest-release", "overridden");
  const config = createWebTargetViteConfig({
    command: "build",
    mode: "jest",
    environment: {JEST_BUILD_OUT_DIR: expected},
  });
  assert.throws(
    () => runBuildContract(config, {outDir: actual}),
    /resolved output directory .* does not match the selected directory/u,
  );
});

test("the build contract rejects roots, repository paths, and another target's canonical artifact", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const repositoryDirectory = path.resolve(packageDirectory);
  for (const unsafeDirectory of [
    platformDirectory("jest"),
    repositoryDirectory,
    path.dirname(repositoryDirectory),
  ]) {
    const config = createWebTargetViteConfig({
      command: "build",
      mode: "jest",
      environment: {JEST_BUILD_OUT_DIR: unsafeDirectory},
    });
    assert.throws(
      () => runBuildContract(config, {outDir: unsafeDirectory}),
      /must not be the project, repository, or one of their ancestors/u,
    );
  }

  for (const unsafeDirectory of [
    path.join(packageDirectory, "src"),
    path.join(repositoryDirectory, "docs", "generated-web-target"),
    path.join(packageDirectory, "builds/jest", "nested"),
  ]) {
    const config = createWebTargetViteConfig({
      command: "build",
      mode: "jest",
      environment: {JEST_BUILD_OUT_DIR: unsafeDirectory},
    });
    assert.throws(
      () => runBuildContract(config, {outDir: unsafeDirectory}),
      /output inside the project or repository must be its canonical directory/u,
    );
  }

  const crossTarget = createWebTargetViteConfig({
    command: "build",
    mode: "jest",
    environment: {JEST_BUILD_OUT_DIR: "builds/facebook"},
  });
  assert.throws(
    () => runBuildContract(crossTarget, {outDir: path.join(repositoryDirectory, "builds/facebook")}),
    /collides with the facebook canonical artifact/u,
  );
});

test("explicit development profiles serve their owned HTML without redirecting signed query parameters", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const mode of ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"]) {
    const development = createWebTargetViteConfig({command: "serve", mode, environment: {}});
    const plugin = development.plugins.flat(Infinity).find(
      (candidate) => candidate?.name === "riddle-quest-web-target-html",
    );
    assert.ok(plugin);
    assert.equal(development.root, `${platformDirectory(mode)}${path.sep}`);
    assert.equal(development.envDir, development.root);
    assert.equal(Object.hasOwn(plugin, "configureServer"), false);
    const entry = typeof development.build.rolldownOptions.input === "string"
      ? development.build.rolldownOptions.input
      : development.build.rolldownOptions.input.game;
    assert.equal(entry, path.join(platformDirectory(mode), "index.html"));
  }
  assert.throws(
    () => createWebTargetViteConfig({
      command: "build",
      mode: "facebook",
      environment: {YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE: "1"},
    }),
    /fixture can only be used with a self-contained Web Target/u,
  );
});

test("each target-owned HTML document imports one explicit target main and only its allowed SDK", async () => {
  const documents = [
    {
      file: "platforms/web/jest/index.html",
      module: "/src/main.tsx",
      externalScripts: ["https://cdn.jest.com/sdk/latest/jestsdk.js"],
    },
    {
      file: "platforms/web/facebook/index.html",
      module: "/src/main.tsx",
      externalScripts: ["https://connect.facebook.net/en_US/fbinstant.8.0.js"],
    },
    {file: "platforms/web/reddit/index.html", module: "/src/main.tsx", externalScripts: []},
    {file: "platforms/web/reddit/reddit-inline.html", module: "/src/inline.ts", externalScripts: []},
    {
      file: "platforms/web/youtube/index.html",
      module: "/src/main.tsx",
      externalScripts: ["https://www.youtube.com/game_api/v1"],
    },
    {file: "platforms/web/netflix/index.html", module: "/src/main.tsx", externalScripts: []},
    {file: "platforms/web/yahoo/index.html", module: "/src/main.tsx", externalScripts: []},
  ];

  for (const document of documents) {
    const html = await readFile(path.join(packageDirectory, document.file), "utf8");
    const moduleScripts = html.match(/<script\b[^>]*\btype="module"[^>]*><\/script>/gu) ?? [];
    assert.equal(moduleScripts.length, 1, `${document.file} must have one module entry`);
    assert.equal(moduleScripts[0].includes(`src="${document.module}"`), true);
    const externalScripts = [...html.matchAll(/<script\b[^>]*\bsrc="(https:\/\/[^"]+)"[^>]*><\/script>/gu)]
      .map((match) => match[1]);
    assert.deepEqual(externalScripts, document.externalScripts);
  }
});

async function withFixture(platform, operation) {
  const directory = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-audit-`));
  try {
    await writeFile(
      path.join(directory, "app.js"),
      platform === "youtube"
        ? "const sdk = globalThis.ytgame; sdk.game.firstFrameReady(); sdk.game.gameReady(); sdk.game.loadData(); sdk.game.saveData('{}'); sdk.system.getLanguage(); sdk.system.isAudioEnabled(); sdk.system.onAudioEnabledChange(()=>{}); sdk.system.onPause(()=>{}); sdk.system.onResume(()=>{});\n"
        : platform === "reddit"
          ? 'const copy = {RedditPlatform: {TAGLINE: "fixture"}}; console.log(copy);\n'
          : 'console.log("grindheadgames@gmail.com");\n',
    );
    if (!["youtube", "netflix", "yahoo"].includes(platform)) {
      await writeFile(
        path.join(directory, "third-party-licenses.txt"),
        "@sentry/browser@1\nfirebase@1\nreact@1\nreact-dom@1\nthree@1\n",
      );
    }
    if (platform === "jest") {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><script async src="https://cdn.jest.com/sdk/latest/jestsdk.js"></script></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
    } else if (platform === "facebook") {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><script src="https://connect.facebook.net/en_US/fbinstant.8.0.js"></script></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
      await writeFile(path.join(directory, "fbapp-config.json"), `${JSON.stringify({
        instant_games: {platform_version: "RICH_GAMEPLAY", navigation_menu_version: "NAV_FLOATING"},
      })}\n`);
    } else if (platform === "reddit") {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
      await writeFile(path.join(directory, "reddit-inline.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
    } else if (platform === "netflix" || platform === "yahoo") {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
      await writeFile(path.join(directory, "youtube-content-manifest.json"), `${JSON.stringify({
        target: `${platform}-candidate`,
        fixture: false,
        releaseReady: true,
        locales: Array.from({length: 16}, (_, index) => `fixture-${index}`),
        classicRiddleCount: 180,
      })}\n`);
    } else {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><script src="https://www.youtube.com/game_api/v1"></script></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
      await writeFile(path.join(directory, "youtube-content-manifest.json"), `${JSON.stringify({
        schemaVersion: 1,
        target: "youtube-playables",
        contentVersion: "fixture-v1",
        contentSha256: "a".repeat(64),
        releaseReady: false,
        fixture: true,
        locales: ["en"],
        classicRiddleCount: 3,
        dailyScheduleEntries: 3,
      })}\n`);
    }
    await operation(directory);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

test("artifact audits follow the same output override selected by each Web Target", async () => {
  for (const [platform, script, environmentName, extraArguments] of [
    ["jest", jestAudit, "JEST_BUILD_OUT_DIR", []],
    ["facebook", facebookAudit, "FACEBOOK_BUILD_OUT_DIR", []],
    ["reddit", redditAudit, "REDDIT_BUILD_OUT_DIR", []],
    ["youtube", youtubeAudit, "YOUTUBE_BUILD_OUT_DIR", ["--allow-incomplete-fixture"]],
  ]) {
    await withFixture(platform, async (directory) => {
      const result = spawnSync(process.execPath, [script, ...extraArguments], {
        cwd: packageDirectory,
        encoding: "utf8",
        env: {...process.env, [environmentName]: directory},
      });
      assert.equal(result.status, 0, `${platform}: ${result.stderr}`);
    });
  }
});

for (const platform of ["netflix", "yahoo"]) {
  test(`${platform} package audit rejects contaminated selected output despite a clean default artifact`, async () => {
    await withFixture(platform, async (directory) => {
      const workspace = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-audit-command-`));
      try {
        await cp(directory, path.join(workspace, `dist-${platform}`), {recursive: true});
        await mkdir(path.join(workspace, "scripts/web"), {recursive: true});
        await symlink(standaloneAudit, path.join(workspace, "scripts/web/audit-standalone-artifact.mjs"));
        const {scripts} = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
        const command = `audit:${platform}-artifact`;
        await writeFile(path.join(workspace, "package.json"), JSON.stringify({scripts: {[command]: scripts[command]}}));
        await writeFile(path.join(directory, "app.js"), "globalThis.FBInstant.initializeAsync();\n");
        const result = spawnSync("pnpm", ["run", command], {
          cwd: workspace,
          encoding: "utf8",
          env: {...process.env, [`${platform.toUpperCase()}_BUILD_OUT_DIR`]: directory},
        });
        assert.notEqual(result.status, 0, `${platform} audited the clean stale artifact instead of the contaminated build`);
        assert.match(result.stderr, new RegExp(`Facebook integration found in ${platform} candidate artifact`, "u"));
      } finally {
        await rm(workspace, {recursive: true, force: true});
      }
    });
  });

  test(`${platform} audit respects explicit directory, target-specific environment and default precedence`, async () => {
    await withFixture(platform, async (directory) => {
      const workspace = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-audit-precedence-`));
      try {
        const portalDirectory = path.join(workspace, ".");
        await mkdir(portalDirectory, {recursive: true});
        const defaultDirectory = path.join(workspace, `builds/${platform}`);
        const contaminatedDirectory = path.join(workspace, "contaminated");
        await cp(directory, defaultDirectory, {recursive: true});
        await cp(directory, contaminatedDirectory, {recursive: true});
        await writeFile(path.join(contaminatedDirectory, "app.js"), "globalThis.FBInstant.initializeAsync();\n");
        const environmentName = `${platform.toUpperCase()}_BUILD_OUT_DIR`;
        const otherEnvironmentName = platform === "netflix" ? "YAHOO_BUILD_OUT_DIR" : "NETFLIX_BUILD_OUT_DIR";
        const invoke = (args, overrides) => spawnSync(process.execPath, [standaloneAudit, platform, ...args], {
          cwd: portalDirectory,
          encoding: "utf8",
          env: {...process.env, [environmentName]: "", [otherEnvironmentName]: contaminatedDirectory, ...overrides},
        });
        const selected = invoke([], {[environmentName]: `  ${directory}  `});
        assert.equal(selected.status, 0, selected.stderr);
        const explicit = invoke([directory], {[environmentName]: contaminatedDirectory});
        assert.equal(explicit.status, 0, explicit.stderr);
        const fallback = invoke([], {[environmentName]: "  "});
        assert.equal(fallback.status, 0, fallback.stderr);
        const missingDirectory = path.join(workspace, "missing");
        const missing = invoke([], {[environmentName]: missingDirectory});
        assert.notEqual(missing.status, 0);
        assert.ok(missing.stderr.includes(missingDirectory), missing.stderr);
      } finally {
        await rm(workspace, {recursive: true, force: true});
      }
    });
  });
}

test("Jest audit accepts its fixture and rejects Facebook contamination", async () => {
  await withFixture("jest", async (directory) => {
    const clean = runAudit(jestAudit, directory);
    assert.equal(clean.status, 0, clean.stderr);
    await writeFile(path.join(directory, "app.js"), "window.FBInstant.initializeAsync();\n");
    const contaminated = runAudit(jestAudit, directory);
    assert.notEqual(contaminated.status, 0);
    assert.match(contaminated.stderr, /Facebook Instant Games integration/);
  });
});

test("Facebook audit rejects the navigation menu value rejected by Meta", async () => {
  await withFixture("facebook", async (directory) => {
    const configPath = path.join(directory, "fbapp-config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.instant_games.navigation_menu_version = "NAV_2";
    await writeFile(configPath, JSON.stringify(config));
    const invalid = runAudit(facebookAudit, directory);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /NAV_FLOATING/);
  });
});

test("Facebook audit rejects SDK-version bundle configuration", async () => {
  await withFixture("facebook", async (directory) => {
    const configPath = path.join(directory, "fbapp-config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.instant_games.platform_version = "8.0";
    config.instant_games.orientation = "both";
    await writeFile(configPath, JSON.stringify(config));
    const invalid = runAudit(facebookAudit, directory);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /RICH_GAMEPLAY/);
  });
});

test("Facebook audit accepts reviewed custom update templates and rejects malformed declarations", async () => {
  await withFixture("facebook", async directory => {
    const configPath = path.join(directory, "fbapp-config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.instant_games.custom_update_templates = {race_context_challenge: {example: "Race to 10 · Challenge a friend"}};
    await writeFile(configPath, JSON.stringify(config));
    const accepted = runAudit(facebookAudit, directory);
    assert.equal(accepted.status, 0, accepted.stderr);
    for (const templates of [[], null, {race_context_challenge: {}}, {race_context_challenge: {example: 42}},
      {race_context_challenge: {example: " "}}, {"invalid name": {example: "Example"}}]) {
      config.instant_games.custom_update_templates = templates;
      await writeFile(configPath, JSON.stringify(config));
      const invalid = runAudit(facebookAudit, directory);
      assert.notEqual(invalid.status, 0);
      assert.match(invalid.stderr, /custom update templates/);
    }
  });
});

test("Facebook client template overrides must match its bundled review configuration", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  const config = createWebTargetViteConfig({command: "build", mode: "facebook", environment: {}});
  const plugin = config.plugins.flat(Infinity).find(candidate => candidate?.name === "riddle-quest-facebook-artifact");
  assert.ok(plugin);
  plugin.configResolved({env: {VITE_FACEBOOK_CONTEXT_CHALLENGE_TEMPLATE: "race_context_challenge"}});
  plugin.configResolved({env: {VITE_FACEBOOK_CONTEXT_CHALLENGE_TEMPLATE: ""}});
  for (const template of ["undeclared", "invalid name"]) {
    assert.throws(() => plugin.configResolved({env: {VITE_FACEBOOK_CONTEXT_CHALLENGE_TEMPLATE: template}}),
      /must be declared in fbapp-config.json/);
  }
});

test("Facebook audit rejects direct parent-window messaging", async () => {
  await withFixture("facebook", async (directory) => {
    await writeFile(path.join(directory, "app.js"), "window.parent.postMessage({type: 'game:ready'}, window.location.origin);");
    const contaminated = runAudit(facebookAudit, directory);
    assert.notEqual(contaminated.status, 0);
    assert.match(contaminated.stderr, /Direct parent-window messaging/);
  });
});

test("Facebook audit accepts its fixture and rejects Jest contamination", async () => {
  await withFixture("facebook", async (directory) => {
    const clean = runAudit(facebookAudit, directory);
    assert.equal(clean.status, 0, clean.stderr);
    await writeFile(path.join(directory, "app.js"), "window.JestSDK.init();\n");
    const contaminated = runAudit(facebookAudit, directory);
    assert.notEqual(contaminated.status, 0);
    assert.match(contaminated.stderr, /Jest SDK/);
  });
});

test("Jest and Facebook audits reject the other target's App Check adapter", async () => {
  await withFixture("jest", async (directory) => {
    await writeFile(
      path.join(directory, "app.js"),
      "throw new Error('Facebook App Check token provider is unavailable.');\n",
    );
    const result = runAudit(jestAudit, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Facebook App Check adapter/u);
  });
  await withFixture("facebook", async (directory) => {
    await writeFile(
      path.join(directory, "app.js"),
      "throw new Error('Firebase App Check is not configured for the Jest build.');\n",
    );
    const result = runAudit(facebookAudit, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Jest App Check adapter/u);
  });
});

test("Facebook and Reddit audits reject the Jest-only sharing event bridge", async () => {
  await withFixture("facebook", async (directory) => {
    await writeFile(
      path.join(directory, "app.js"),
      'window.dispatchEvent(new CustomEvent("riddle-quest:share-invite"));\n',
    );
    const result = runAudit(facebookAudit, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Jest sharing event bridge/u);
  });
  await withFixture("reddit", async (directory) => {
    await writeFile(
      path.join(directory, "app.js"),
      'window.dispatchEvent(new CustomEvent("riddle-quest:share-race"));\n',
    );
    const result = runAudit(redditAudit, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Jest sharing event bridge/u);
  });
});

test("Reddit audit accepts both entry documents and rejects platform SDKs and telemetry", async () => {
  await withFixture("reddit", async (directory) => {
    const clean = runAudit(redditAudit, directory);
    assert.equal(clean.status, 0, clean.stderr);
    for (const [contamination, expected] of [
      ["window.JestSDK.init();\n", /Jest SDK/],
      ["window.FBInstant.initializeAsync();\n", /Facebook SDK/],
      ["globalThis.__SENTRY__ = {version: 'fixture'};\n", /external analytics/],
    ]) {
      await writeFile(path.join(directory, "app.js"), contamination);
      const result = runAudit(redditAudit, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    }
  });
});

test("Reddit audit requires and validates the shipped inline entry document", async () => {
  await withFixture("reddit", async (directory) => {
    await rm(path.join(directory, "reddit-inline.html"));
    const missing = runAudit(redditAudit, directory);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /missing reddit-inline\.html/u);
  });
  await withFixture("reddit", async (directory) => {
    await writeFile(path.join(directory, "reddit-inline.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body><script src="https://example.test/remote.js"></script></body></html>\n`);
    const external = runAudit(redditAudit, directory);
    assert.notEqual(external.status, 0);
    assert.match(external.stderr, /reddit-inline\.html contains an external resource/u);
  });
});

test("YouTube audit accepts only its explicit engineering fixture and rejects other platform SDKs", async () => {
  await withFixture("youtube", async (directory) => {
    const clean = runPlatformAudit("youtube", directory);
    assert.equal(clean.status, 0, clean.stderr);
    for (const [contamination, expected] of [
      ["window.JestSDK.init();\n", /Jest SDK/u],
      ["window.FBInstant.initializeAsync();\n", /Facebook Instant Games SDK/u],
      ["globalThis.devvit = {};\n", /Reddit Devvit integration/u],
    ]) {
      await writeFile(path.join(directory, "app.js"), contamination);
      const result = runPlatformAudit("youtube", directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    }
  });
});

test("existing target audits reject YouTube SDK, adapter, and bundled-content contamination", async () => {
  for (const platform of ["jest", "facebook", "reddit"]) {
    await withFixture(platform, async (directory) => {
      for (const [kind, contamination] of [
        ["SDK", "globalThis.ytgame = {}; // www.youtube.com/game_api/v1\n"],
        ["adapter", "const sdkFailure = 'youtube-sdk-unavailable';\n"],
        ["bundled content", "const contentFailure = 'youtube-content-envelope-invalid';\n"],
      ]) {
        await writeFile(path.join(directory, "app.js"), contamination);
        const result = runPlatformAudit(platform, directory);
        assert.notEqual(result.status, 0, `${platform} unexpectedly accepted YouTube ${kind} contamination`);
        assert.match(result.stderr, /YouTube Playables/u);
      }
    });
  }
});

test("Reddit audit rejects forbidden commerce UI in compiled commerce chunks", async () => {
  await withFixture("reddit", async (directory) => {
    for (const [contamination, expected] of [
      ["const css = 'shop-subscription-card';\n", /subscription UI/],
      ["const copy = 'Premium subscription';\n", /premium shop copy/],
      ["const sku = 'remove_interstitial_ads';\n", /advertising|Remove Ads product/],
    ]) {
      await writeFile(path.join(directory, "GameModalView-fixture.js"), contamination);
      const result = runAudit(redditAudit, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    }
  });
});

test("Jest and Facebook audits reject Reddit Devvit contamination", async () => {
  for (const platform of ["jest", "facebook"]) {
    await withFixture(platform, async (directory) => {
      await writeFile(path.join(directory, "app.js"), "globalThis.devvit = {redditGatewaySecret: 'fixture'};\n");
      const result = runAudit(platform === "jest" ? jestAudit : facebookAudit, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Reddit Devvit integration/);
    });
  }
});

test("every non-Reddit audit rejects Reddit-owned locale copy", async () => {
  for (const platform of ["jest", "facebook", "youtube"]) {
    await withFixture(platform, async (directory) => {
      await writeFile(path.join(directory, "app.js"), "const copy = {RedditPlatform: {TAGLINE: 'fixture'}};\n");
      const result = runPlatformAudit(platform, directory);
      assert.notEqual(result.status, 0, `${platform} unexpectedly accepted Reddit-owned copy`);
      assert.match(result.stderr, /Reddit Devvit integration/);
    });
  }
});

for (const [label, contamination] of [
  ["Meta app secret identifier", "const key = 'FACEBOOK_APP_SECRET';\n"],
  ["Meta UID secret identifier", "const key = 'FACEBOOK_UID_SECRET';\n"],
  ["service-account JSON", `const credential = {"type":"service_account","private_key_id":"fixture"};\n`],
]) {
  test(`both artifact audits reject ${label}`, async () => {
    for (const platform of ["jest", "facebook", "reddit", "youtube"]) {
      await withFixture(platform, async (directory) => {
        await writeFile(path.join(directory, "app.js"), contamination);
        const result = runPlatformAudit(platform, directory);
        assert.notEqual(result.status, 0, `${platform} unexpectedly accepted ${label}`);
        assert.match(result.stderr, /(?:secret|service account|private key)/iu);
      });
    }
  });
}

test("all artifact audits reject symbolic links escaping the build root", async () => {
  for (const platform of ["jest", "facebook", "reddit", "youtube"]) {
    await withFixture(platform, async (directory) => {
      const externalDirectory = await mkdtemp(path.join(tmpdir(), "riddle-quest-external-artifact-"));
      try {
        await writeFile(path.join(externalDirectory, "outside.txt"), "outside the artifact\n");
        await symlink(
          externalDirectory,
          path.join(directory, "external-target"),
          process.platform === "win32" ? "junction" : "dir",
        );
        await assert.rejects(
          inspectWebTargetArtifact({rootDirectory: directory, target: platform}),
          /non-regular entry/iu,
        );
      } finally {
        await rm(externalDirectory, {recursive: true, force: true});
      }
    });
  }
});

test("all artifact audits reject a linked artifact root before following it", async () => {
  for (const platform of ["jest", "facebook", "reddit", "youtube"]) {
    await withFixture(platform, async (directory) => {
      const linkDirectory = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-root-link-`));
      const linkedRoot = path.join(linkDirectory, "artifact");
      try {
        await symlink(directory, linkedRoot, process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(
          inspectWebTargetArtifact({rootDirectory: linkedRoot, target: platform}),
          new RegExp(`${targetName(platform)} artifact root must be a real directory, not a link`, "u"),
        );
      } finally {
        await rm(linkDirectory, {recursive: true, force: true});
      }
    });
  }
});

test("all artifact audits scan environment and text files for common credentials", async () => {
  for (const [filename, contamination, expected] of [
    [".env.production", "OPENAI_API_KEY=fixture-secret\n", /server secret/iu],
    ["credentials.txt", "-----BEGIN PRIVATE KEY-----\nfixture\n", /private key/iu],
  ]) {
    for (const platform of ["jest", "facebook", "reddit", "youtube"]) {
      await withFixture(platform, async (directory) => {
        await writeFile(path.join(directory, filename), contamination);
        await assert.rejects(
          inspectWebTargetArtifact({rootDirectory: directory, target: platform}),
          (error) => {
            assert.match(error.message, expected);
            assert.equal(error.message.includes(filename), true);
            return true;
          },
        );
      });
    }
  }
});

test("the common inventory rejects every canonical server-only identifier", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-common-secret-inventory-"));
  try {
    for (const identifier of [
      "JEST_SHARED_SECRET",
      "FACEBOOK_APP_SECRET",
      "FACEBOOK_UID_SECRET",
      "META_APP_SECRET",
      "REDDIT_CLIENT_SECRET",
      "REDDIT_UID_SECRET",
      "OPENAI_API_KEY",
      "GOOGLE_APPLICATION_CREDENTIALS",
    ]) {
      await writeFile(path.join(directory, "credential.txt"), `${identifier}=fixture\n`);
      await assert.rejects(
        inspectWebTargetArtifact({rootDirectory: directory, target: "jest"}),
        /server secret found in Jest artifact: credential\.txt/iu,
      );
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test("the common inventory validates its target and returns deterministic file order", async () => {
  await assert.rejects(
    inspectWebTargetArtifact({rootDirectory: packageDirectory, target: "unknown"}),
    /Unknown Web Target artifact audit: "unknown"/u,
  );

  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-artifact-order-"));
  try {
    await writeFile(path.join(directory, "z.js"), "export const z = true;\n");
    await writeFile(path.join(directory, "a.js"), "export const a = true;\n");
    const inventory = await inspectWebTargetArtifact({rootDirectory: directory, target: "jest"});
    assert.deepEqual(inventory.files.map((file) => path.basename(file)), ["a.js", "z.js"]);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test("the Jest audit scans progress files for common credentials", async () => {
  await withFixture("jest", async (directory) => {
    const progressDirectory = path.join(directory, "progress");
    await mkdir(progressDirectory, {recursive: true});
    await writeFile(path.join(progressDirectory, "leak.js"), "const secret = 'FACEBOOK_APP_SECRET';\n");
    await assert.rejects(
      inspectWebTargetArtifact({rootDirectory: directory, target: "jest"}),
      /server secret found in Jest artifact: progress[\\/]leak\.js/iu,
    );
  });
});

test("all artifact audits reject an empty real directory through the common inventory", async () => {
  for (const platform of ["jest", "facebook", "reddit", "youtube"]) {
    const directory = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-empty-artifact-`));
    try {
      await assert.rejects(
        inspectWebTargetArtifact({rootDirectory: directory, target: platform}),
        new RegExp(`${targetName(platform)} artifact is empty`, "u"),
      );
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  }
});
