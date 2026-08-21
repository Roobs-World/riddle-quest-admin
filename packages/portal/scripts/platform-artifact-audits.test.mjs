import assert from "node:assert/strict";
import {mkdtemp, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";

const packageDirectory = path.resolve(new URL("..", import.meta.url).pathname);
const jestAudit = path.join(packageDirectory, "scripts/audit-jest-artifact.mjs");
const facebookAudit = path.join(packageDirectory, "scripts/audit-facebook-artifact.mjs");
const redditAudit = path.join(packageDirectory, "scripts/audit-reddit-artifact.mjs");
const youtubeAudit = path.join(packageDirectory, "scripts/audit-youtube-artifact.mjs");
const viteBin = path.join(packageDirectory, "node_modules/vite/bin/vite.js");

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

test("production Vite builds reject unknown targets instead of falling back to Jest", () => {
  const result = spawnSync(process.execPath, [viteBin, "build", "--mode", "unknown-target"], {
    cwd: packageDirectory,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Unknown production web target mode: unknown-target/u);
});

test("YouTube Vite builds reject private Sentry upload configuration", () => {
  const result = spawnSync(process.execPath, [viteBin, "build", "--mode", "youtube"], {
    cwd: packageDirectory,
    encoding: "utf8",
    env: {
      ...process.env,
      YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE: "1",
      SENTRY_UPLOAD_SOURCEMAPS: "1",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Sentry source-map upload is forbidden/u);
});

async function withFixture(platform, operation) {
  const directory = await mkdtemp(path.join(tmpdir(), `riddle-quest-${platform}-audit-`));
  try {
    await writeFile(
      path.join(directory, "app.js"),
      platform === "youtube"
        ? "const sdk = globalThis.ytgame; sdk.game.firstFrameReady(); sdk.game.gameReady(); sdk.game.loadData(); sdk.game.saveData('{}'); sdk.system.getLanguage(); sdk.system.isAudioEnabled(); sdk.system.onAudioEnabledChange(()=>{}); sdk.system.onPause(()=>{}); sdk.system.onResume(()=>{});\n"
        : 'console.log("grindheadgames@gmail.com");\n',
    );
    if (platform !== "youtube") {
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
        instant_games: {platform_version: "8.0", orientation: "both", navigation_menu_version: "NAV_2"},
      })}\n`);
    } else if (platform === "reddit") {
      await writeFile(path.join(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body><script type="module" src="./app.js"></script></body></html>\n`);
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

test("Reddit audit accepts its fixture and rejects both platform SDKs", async () => {
  await withFixture("reddit", async (directory) => {
    const clean = runAudit(redditAudit, directory);
    assert.equal(clean.status, 0, clean.stderr);
    for (const [contamination, expected] of [
      ["window.JestSDK.init();\n", /Jest SDK/],
      ["window.FBInstant.initializeAsync();\n", /Facebook SDK/],
    ]) {
      await writeFile(path.join(directory, "app.js"), contamination);
      const result = runAudit(redditAudit, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    }
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
      await symlink("/etc/passwd", path.join(directory, "external-target"));
      const result = runPlatformAudit(platform, directory);
      assert.notEqual(result.status, 0, `${platform} unexpectedly accepted a symbolic link`);
      assert.match(result.stderr, /non-regular entry/iu);
    });
  }
});
