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
const targetName = () => "Jest";

const runAudit = (script, directory, extraArguments = []) => spawnSync(process.execPath, [script, directory, ...extraArguments], {
  cwd: packageDirectory,
  encoding: "utf8",
});

const runPlatformAudit = (_platform, directory) => runAudit(jestAudit, directory);

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
  for (const target of ["jest",]) {
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
});

test("Vite configuration requires an explicit known Web Target for build and serve", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const command of ["build", "serve"]) {
    assert.throws(
      () => createWebTargetViteConfig({command, mode: "unknown-target", environment: {}}),
      /Unknown Web Target mode: unknown-target; expected jest/u,
    );
  }
  assert.throws(
    () => createWebTargetViteConfig({command: "serve", mode: "development", environment: {}}),
    /Unknown Web Target mode: development/u,
  );
});

test("one selected output directory drives each Web Target build", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const [mode, environmentName] of [
    ["jest", "JEST_BUILD_OUT_DIR"],
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
    mode: "jest",
    environment: {VITE_PLATFORM_TARGET: "reddit"},
  });
  assert.equal(config.define["import.meta.env.VITE_PLATFORM_TARGET"], JSON.stringify("jest"));

  const packageManifest = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
  for (const script of ["build:reddit", "build:youtube", "build:youtube:fixture", "build:netflix", "build:yahoo"]) {
    assert.doesNotMatch(packageManifest.scripts[script], /\bVITE_PLATFORM_TARGET=/u);
  }
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
    path.join(packageDirectory, "platforms/web/jest/build/dist", "nested"),
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
    environment: {JEST_BUILD_OUT_DIR: "platforms/web/reddit/build/dist"},
  });
  assert.throws(
    () => runBuildContract(crossTarget, {outDir: path.join(repositoryDirectory, "platforms/web/reddit/build/dist")}),
    /collides with the reddit canonical artifact/u,
  );
});

test("explicit development profiles serve their owned HTML without redirecting signed query parameters", async () => {
  const {createWebTargetViteConfig} = await import("./build/webTargetViteConfig.ts");
  for (const mode of ["jest",]) {
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
      mode: "jest",
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
  assert.equal(platform, "jest");
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-jest-audit-"));
  try {
    await writeFile(path.join(directory, "app.js"), "console.log('fixture');\n");
    await writeFile(path.join(directory, "index.html"), '<!doctype html><html lang="en"><head><meta charset="UTF-8"><script async src="https://cdn.jest.com/sdk/latest/jestsdk.js"></script></head><body><script type="module" src="./app.js"></script></body></html>\n');
    await operation(directory);
  } finally {await rm(directory, {recursive: true, force: true});}
}

test("artifact audits follow the same output override selected by each Web Target", async () => {
  for (const [platform, script, environmentName, extraArguments] of [
    ["jest", jestAudit, "JEST_BUILD_OUT_DIR", []],
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

test("Jest audit accepts Firebase account services and rejects browser push, FCM and Facebook", async () => {
  await withFixture("jest", async (directory) => {
    await writeFile(path.join(directory, "app.js"), 'console.log("grindheadgames@gmail.com", "firebase/auth", "firebase/firestore", "@firebase/messaging", "@firebase/messaging-compat");\n');
    const clean = runAudit(jestAudit, directory);
    assert.equal(clean.status, 0, clean.stderr);
    for (const browserPush of [
      'Notification.requestPermission();',
      'registration.showNotification("Challenge");',
      'new PushManager();',
      'self.addEventListener("push", () => {});',
      'import("firebase/messaging");',
      'fetch("https://fcmregistrations.googleapis.com/v1/projects/example");',
      'setLiveRacePushSubscription({enabled: true});',
    ]) {
      await writeFile(path.join(directory, "app.js"), browserPush);
      const rejected = runAudit(jestAudit, directory);
      assert.notEqual(rejected.status, 0, browserPush);
      assert.match(rejected.stderr, /Browser push notifications|Firebase Cloud Messaging/);
    }
    await writeFile(path.join(directory, "app.js"), "window.FBInstant.initializeAsync();\n");
    const contaminated = runAudit(jestAudit, directory);
    assert.notEqual(contaminated.status, 0);
    assert.match(contaminated.stderr, /Facebook Instant Games integration/);
  });
});

test("Jest audit reject the other target's App Check adapter", async () => {
  await withFixture("jest", async (directory) => {
    await writeFile(
      path.join(directory, "app.js"),
      "throw new Error('Facebook App Check token provider is unavailable.');\n",
    );
    const result = runAudit(jestAudit, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Facebook App Check adapter/u);
  });
});

test("existing target audits reject YouTube SDK, adapter, and bundled-content contamination", async () => {
  for (const platform of ["jest",]) {
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

test("Jest audit reject Reddit Devvit contamination", async () => {
  for (const platform of ["jest",]) {
    await withFixture(platform, async (directory) => {
      await writeFile(path.join(directory, "app.js"), "globalThis.devvit = {redditGatewaySecret: 'fixture'};\n");
      const result = runAudit(jestAudit, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Reddit Devvit integration/);
    });
  }
});

test("every non-Reddit audit rejects Reddit-owned locale copy", async () => {
  for (const platform of ["jest",]) {
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
    for (const platform of ["jest",]) {
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
  for (const platform of ["jest",]) {
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
  for (const platform of ["jest",]) {
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
    for (const platform of ["jest",]) {
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
  for (const platform of ["jest",]) {
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
