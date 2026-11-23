import assert from "node:assert/strict";
import {access, appendFile, mkdir, mkdtemp, readFile, rm, truncate, utimes, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {randomBytes} from "node:crypto";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {auditYouTubeArtifact} from "./audit-youtube-artifact.mjs";
import {
  captureSourceIdentity,
  createDeterministicZip,
  crc32,
  packageYouTubeArtifact,
  sha256,
  writeYouTubeVerificationReport,
  youtubeReleaseVerificationSuites,
} from "./youtube-release-artifact.mjs";
import {runYouTubeReleaseVerification} from "./youtube-release-artifact-evidence.mjs";

const releaseLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi",
];
const translatedLocales = releaseLocales.filter((locale) => locale !== "en");

function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const passedTests = () => youtubeReleaseVerificationSuites.map(({id, command}) => ({
  id,
  command,
  status: "passed",
  exitCode: 0,
  stdoutSha256: sha256(Buffer.from(`stdout:${id}`, "utf8")),
  stderrSha256: sha256(Buffer.alloc(0)),
}));

async function createReleaseFixture(context) {
  const repositoryDirectory = await mkdtemp(path.join(tmpdir(), "rq-youtube-release-"));
  context.after(() => rm(repositoryDirectory, {recursive: true, force: true}));
  await writeFile(path.join(repositoryDirectory, ".gitignore"), [
    "/dist-youtube/",
    "/release-inputs/",
    "/build-*.zip",
    "/build-*.manifest.json",
    "/build-youtube.test-report.json",
    "",
  ].join("\n"));
  await writeFile(path.join(repositoryDirectory, "source.txt"), "release source\n");
  git(repositoryDirectory, ["init", "--quiet"]);
  git(repositoryDirectory, ["config", "user.name", "Release Fixture"]);
  git(repositoryDirectory, ["config", "user.email", "release-fixture@example.invalid"]);
  git(repositoryDirectory, ["add", ".gitignore", "source.txt"]);
  git(repositoryDirectory, ["commit", "--quiet", "-m", "fixture"]);

  const distDirectory = path.join(repositoryDirectory, "dist-youtube");
  await mkdir(path.join(distDirectory, "assets"), {recursive: true});
  await writeFile(path.join(distDirectory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><script src="https://www.youtube.com/game_api/v1"></script></head>
<body><script type="module" src="./assets/app.js"></script></body></html>\n`);
  await writeFile(
    path.join(distDirectory, "assets/app.js"),
    "const sdk=globalThis.ytgame;sdk.game.firstFrameReady();sdk.game.gameReady();sdk.game.loadData();sdk.game.saveData('{}');sdk.system.getLanguage();sdk.system.isAudioEnabled();sdk.system.onAudioEnabledChange(()=>{});sdk.system.onPause(()=>{});sdk.system.onResume(()=>{});\n",
  );
  const contentSha256 = "a".repeat(64);
  const contentVersion = "youtube-content-v1-release-fixture";
  await writeFile(path.join(distDirectory, "youtube-content-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    target: "youtube-playables",
    contentVersion,
    contentSha256,
    releaseReady: true,
    fixture: false,
    locales: releaseLocales,
    classicRiddleCount: 180,
    dailyScheduleEntries: 180,
  })}\n`);
  const releaseInputs = path.join(repositoryDirectory, "release-inputs");
  await mkdir(releaseInputs, {recursive: true});
  const contentAuditPath = path.join(releaseInputs, "youtube-content-v1.audit.json");
  await writeFile(contentAuditPath, `${JSON.stringify({
    schemaVersion: 1,
    contentVersion,
    releaseReady: true,
    inputs: {
      canonicalSourceSha256: "b".repeat(64),
      orderManifestSha256: "c".repeat(64),
      canonicalAuthoring: {
        sourceDescriptorSha256: "b".repeat(64),
        generatorModel: "gpt-5.6-sol",
        criticModel: "gpt-5.5",
        appendReceiptCount: 0,
        appendReceiptsSha256: "e".repeat(64),
      },
      translationBundles: Object.fromEntries(translatedLocales.map((locale) => [locale, {
        sha256: sha256(Buffer.from(`translation:${locale}`, "utf8")),
        translatorModel: "gpt-5.6-sol",
        criticModel: "gpt-5.5",
      }])),
    },
    runtime: {sha256: contentSha256, localeCount: 16, riddleCountPerLocale: 180},
  })}\n`);
  const reportPath = path.join(repositoryDirectory, "build-youtube.test-report.json");
  const writeReport = (overrides = {}) => writeYouTubeVerificationReport({
    repositoryDirectory,
    distDirectory,
    contentAuditPath,
    reportPath,
    tests: passedTests(),
    capturedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  });
  return {repositoryDirectory, distDirectory, contentAuditPath, reportPath, writeReport};
}

test("CRC32 and deterministic ZIP bytes are stable across entry order", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const first = createDeterministicZip([
    {name: "index.html", contents: Buffer.from("index")},
    {name: "assets/app.js", contents: Buffer.from("app")},
  ]);
  const second = createDeterministicZip([
    {name: "assets/app.js", contents: Buffer.from("app")},
    {name: "index.html", contents: Buffer.from("index")},
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
  assert.throws(() => createDeterministicZip([
    {name: "../escape", contents: Buffer.alloc(0)},
  ]), /Invalid deterministic ZIP entry/u);
});

test("release packaging produces reproducible root ZIP bytes and a fully bound evidence manifest", async (context) => {
  const fixture = await createReleaseFixture(context);
  await fixture.writeReport();
  const firstArchive = path.join(fixture.repositoryDirectory, "build-repro.zip");
  const firstManifest = path.join(fixture.repositoryDirectory, "build-repro.manifest.json");
  const first = await packageYouTubeArtifact({
    ...fixture,
    archivePath: firstArchive,
    manifestPath: firstManifest,
  });
  const firstArchiveBytes = await readFile(firstArchive);
  await utimes(path.join(fixture.distDirectory, "index.html"), new Date("2030-01-01"), new Date("2030-01-01"));
  const second = await packageYouTubeArtifact({
    ...fixture,
    archivePath: firstArchive,
    manifestPath: firstManifest,
  });
  assert.deepEqual(firstArchiveBytes, await readFile(firstArchive));
  assert.equal(first.manifest.schemaVersion, 2);
  assert.equal(first.manifest.archive.sha256, second.manifest.archive.sha256);
  assert.equal(first.manifest.archive.rootEntry, "index.html");
  assert.equal(first.manifest.archive.deterministicTimestamp, "1980-01-01T00:00:00.000Z");
  assert.equal(first.manifest.source.state, "clean");
  assert.match(first.manifest.source.snapshotSha256, /^[0-9a-f]{64}$/u);
  assert.equal(first.manifest.contentAudit.inputs.canonicalAuthoring.generatorModel, "gpt-5.6-sol");
  assert.equal(first.manifest.contentAudit.inputs.canonicalAuthoring.criticModel, "gpt-5.5");
  assert.equal(first.manifest.contentAudit.inputs.canonicalAuthoring.appendReceiptCount, 0);
  assert.equal(first.manifest.verification.report.tests.length, youtubeReleaseVerificationSuites.length);
  assert.equal(first.manifest.verification.report.certificationChecklist.repository.every(
    ({status}) => status === "passed"
  ), true);
  assert.equal(first.manifest.verification.report.certificationChecklist.external.every(
    ({status, evidence, blocker}) => status === "blocked" && evidence === null && blocker.length > 0
  ), true);
  assert.deepEqual(first.manifest.files.map(({path: file}) => file), [
    "assets/app.js",
    "index.html",
    "youtube-content-manifest.json",
  ]);
  assert.deepEqual(first.manifest, second.manifest);
  const unzip = spawnSync("/usr/bin/unzip", ["-Z1", firstArchive], {encoding: "utf8"});
  assert.equal(unzip.status, 0, unzip.stderr);
  assert.deepEqual(unzip.stdout.trim().split("\n"), first.manifest.files.map(({path: file}) => file));
});

test("source identity fingerprints tracked and untracked dirty content", async (context) => {
  const fixture = await createReleaseFixture(context);
  const clean = await captureSourceIdentity(fixture.repositoryDirectory);
  assert.equal(clean.state, "clean");
  await appendFile(path.join(fixture.repositoryDirectory, "source.txt"), "changed\n");
  const trackedDirty = await captureSourceIdentity(fixture.repositoryDirectory);
  assert.equal(trackedDirty.state, "dirty");
  assert.notEqual(trackedDirty.snapshotSha256, clean.snapshotSha256);
  await writeFile(path.join(fixture.repositoryDirectory, "untracked-source.js"), "export {};\n");
  const untrackedDirty = await captureSourceIdentity(fixture.repositoryDirectory);
  assert.notEqual(untrackedDirty.snapshotSha256, trackedDirty.snapshotSha256);
});

test("source identity fingerprints a tracked diff larger than any output buffer", async (context) => {
  const fixture = await createReleaseFixture(context);
  const clean = await captureSourceIdentity(fixture.repositoryDirectory);
  await writeFile(path.join(fixture.repositoryDirectory, "source.txt"), randomBytes(160 * 1024 * 1024));
  const dirty = await captureSourceIdentity(fixture.repositoryDirectory);
  assert.equal(dirty.state, "dirty");
  assert.notEqual(dirty.snapshotSha256, clean.snapshotSha256);
});

test("packaging rejects reports stale for source, artifact, or content audit mutations", async (context) => {
  await context.test("source mutation", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await fixture.writeReport();
    await appendFile(path.join(fixture.repositoryDirectory, "source.txt"), "changed\n");
    await assert.rejects(packageYouTubeArtifact(fixture), /stale for the current source tree/u);
  });
  await context.test("artifact mutation", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await fixture.writeReport();
    await appendFile(path.join(fixture.distDirectory, "assets/app.js"), "// changed\n");
    await assert.rejects(packageYouTubeArtifact(fixture), /stale for the exact expanded artifact/u);
  });
  await context.test("content audit mutation", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await fixture.writeReport();
    const audit = JSON.parse(await readFile(fixture.contentAuditPath, "utf8"));
    audit.inputs.canonicalAuthoring.appendReceiptCount = 1;
    await writeFile(fixture.contentAuditPath, `${JSON.stringify(audit)}\n`);
    await assert.rejects(packageYouTubeArtifact(fixture), /stale for the exact content\/model audit/u);
  });
});

test("packaging rejects missing, malformed, failed, and incomplete evidence", async (context) => {
  await context.test("missing verification report", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await assert.rejects(packageYouTubeArtifact(fixture), /requires a fresh machine-readable verification report/u);
  });
  await context.test("failed test result", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await fixture.writeReport();
    const report = JSON.parse(await readFile(fixture.reportPath, "utf8"));
    report.tests[0].status = "failed";
    await writeFile(fixture.reportPath, `${JSON.stringify(report)}\n`);
    await assert.rejects(packageYouTubeArtifact(fixture), /no passing evidence/u);
  });
  await context.test("missing canonical authoring audit", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    const audit = JSON.parse(await readFile(fixture.contentAuditPath, "utf8"));
    delete audit.inputs.canonicalAuthoring;
    await writeFile(fixture.contentAuditPath, `${JSON.stringify(audit)}\n`);
    await assert.rejects(fixture.writeReport(), /content audit is incomplete/u);
  });
  await context.test("unapproved independent critic", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    const audit = JSON.parse(await readFile(fixture.contentAuditPath, "utf8"));
    audit.inputs.translationBundles.ar.criticModel = "gpt-5.6-sol";
    await writeFile(fixture.contentAuditPath, `${JSON.stringify(audit)}\n`);
    await assert.rejects(fixture.writeReport(), /approved translator and critic/u);
  });
  await context.test("non-root output", async (subcontext) => {
    const fixture = await createReleaseFixture(subcontext);
    await fixture.writeReport();
    const nested = path.join(fixture.repositoryDirectory, "nested");
    await mkdir(nested);
    await assert.rejects(packageYouTubeArtifact({
      ...fixture,
      archivePath: path.join(nested, "build-youtube.zip"),
    }), /root-level outputs/u);
  });
});

test("verification orchestrator records every exact suite and stops without a report on failure", async (context) => {
  const fixture = await createReleaseFixture(context);
  const commands = [];
  const result = await runYouTubeReleaseVerification({
    repository: fixture.repositoryDirectory,
    distDirectory: fixture.distDirectory,
    contentAuditPath: fixture.contentAuditPath,
    reportPath: fixture.reportPath,
    capturedAt: "2026-08-20T12:00:00.000Z",
    commandRunner: async ({id, command}) => {
      commands.push(command);
      return {
        stdoutSha256: sha256(Buffer.from(id, "utf8")),
        stderrSha256: sha256(Buffer.alloc(0)),
      };
    },
  });
  assert.deepEqual(commands, youtubeReleaseVerificationSuites.map(({command}) => command));
  assert.equal(result.report.tests.length, youtubeReleaseVerificationSuites.length);

  const failedPath = path.join(fixture.repositoryDirectory, "build-failed.test-report.json");
  let calls = 0;
  await assert.rejects(runYouTubeReleaseVerification({
    repository: fixture.repositoryDirectory,
    distDirectory: fixture.distDirectory,
    contentAuditPath: fixture.contentAuditPath,
    reportPath: failedPath,
    commandRunner: async ({id}) => {
      calls += 1;
      if (calls === 3) throw new Error("simulated failing gate");
      return {stdoutSha256: sha256(Buffer.from(id)), stderrSha256: sha256(Buffer.alloc(0))};
    },
  }), /simulated failing gate/u);
  assert.equal(calls, 3);
  await assert.rejects(access(failedPath));
});

test("artifact audit enforces strict platform size and filename boundaries", async (context) => {
  const {distDirectory} = await createReleaseFixture(context);
  const invalidName = path.join(distDirectory, "assets", "bad name.js");
  await writeFile(invalidName, "fixture");
  await assert.rejects(auditYouTubeArtifact(distDirectory), /forbidden filename/u);
  await rm(invalidName);
  const oversized = path.join(distDirectory, "assets", "oversized.bin");
  await writeFile(oversized, "");
  await truncate(oversized, 30 * 1024 * 1024);
  await assert.rejects(auditYouTubeArtifact(distDirectory), /strictly below 30 MiB/u);
});

test("artifact audit rejects network, external navigation, dynamic code, and incomplete content", async (context) => {
  const {distDirectory} = await createReleaseFixture(context);
  const appPath = path.join(distDirectory, "assets/app.js");
  for (const [source, expected] of [
    ["fetch('/remote')", /browser network API/u],
    ["window.open('https://example.com')", /external navigation/u],
    ["eval('1')", /dynamic code evaluation/u],
    ["const endpoint = '/api/game'", /same-origin API route/u],
  ]) {
    await writeFile(appPath, source);
    await assert.rejects(auditYouTubeArtifact(distDirectory), expected);
  }
  await writeFile(
    appPath,
    "const sdk=globalThis.ytgame;sdk.game.firstFrameReady();sdk.game.gameReady();sdk.game.loadData();sdk.game.saveData('{}');sdk.system.getLanguage();sdk.system.isAudioEnabled();sdk.system.onAudioEnabledChange(()=>{});sdk.system.onPause(()=>{});sdk.system.onResume(()=>{});\n",
  );
  const manifestPath = path.join(distDirectory, "youtube-content-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(manifestPath, JSON.stringify({...manifest, releaseReady: false, fixture: true, locales: ["en"]}));
  await assert.rejects(auditYouTubeArtifact(distDirectory), /requires releaseReady content/u);
});

test("artifact audit rejects external resources across emitted text assets", async (context) => {
  const mutations = [
    ["CSS url()", async (distDirectory) => {
      await writeFile(
        path.join(distDirectory, "assets/external.css"),
        ".card{background-image:url(https://example.com/card.png)}\n",
      );
    }],
    ["setAttribute src", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "document.body.setAttribute('src','https://example.com/embed.js');\n",
      );
    }],
    ["protocol-relative setAttribute href", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "document.body.setAttribute('href','//example.com/leave');\n",
      );
    }],
    ["form action", async (distDirectory) => {
      const indexPath = path.join(distDirectory, "index.html");
      const html = await readFile(indexPath, "utf8");
      await writeFile(indexPath, html.replace(
        "</body>",
        '<form action="https://example.com/submit"></form></body>',
      ));
    }],
    ["Image source assignment", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "const remoteImage=new Image();remoteImage.src='https://example.com/image.png';\n",
      );
    }],
    ["script source assignment", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "const remoteScript=document.createElement('script');remoteScript.src='HTTPS://EXAMPLE.COM/code.js';\n",
      );
    }],
    ["YouTube SDK lookalike", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "const notTheSdk='https://www.youtube.com/game_api/v1.evil';\n",
      );
    }],
    ["SVG external image", async (distDirectory) => {
      await writeFile(
        path.join(distDirectory, "assets/external.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/image.png"/></svg>\n',
      );
    }],
    ["text-file external resource", async (distDirectory) => {
      await writeFile(
        path.join(distDirectory, "external.txt"),
        "remote=https://example.com/content.json\n",
      );
    }],
  ];

  for (const [name, mutate] of mutations) {
    await context.test(name, async (subcontext) => {
      const {distDirectory} = await createReleaseFixture(subcontext);
      await mutate(distDirectory);
      await assert.rejects(
        auditYouTubeArtifact(distDirectory),
        /unapproved external URL/u,
      );
    });
  }
});

test("artifact audit rejects root-relative resources across CSS, JavaScript, and SVG", async (context) => {
  const mutations = [
    ["CSS url()", async (distDirectory) => {
      await writeFile(path.join(distDirectory, "assets/root.css"), ".card{background:url('/images/card.png')}\n");
    }],
    ["JavaScript source assignment", async (distDirectory) => {
      await appendFile(
        path.join(distDirectory, "assets/app.js"),
        "const image=document.createElement('img');image.src='/images/card.png';\n",
      );
    }],
    ["SVG href", async (distDirectory) => {
      await writeFile(
        path.join(distDirectory, "assets/root.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="/images/sprites.svg#card"/></svg>\n',
      );
    }],
  ];

  for (const [name, mutate] of mutations) {
    await context.test(name, async (subcontext) => {
      const {distDirectory} = await createReleaseFixture(subcontext);
      await mutate(distDirectory);
      await assert.rejects(auditYouTubeArtifact(distDirectory), /root-relative resource/u);
    });
  }
});

test("artifact audit scans environment and text assets for secrets", async (context) => {
  const mutations = [
    ["environment file", ".env.production", "OPENAI_API_KEY=fixture-secret\n"],
    ["text private key", "credentials.txt", "-----BEGIN PRIVATE KEY-----\nfixture\n"],
  ];
  for (const [name, filename, contents] of mutations) {
    await context.test(name, async (subcontext) => {
      const {distDirectory} = await createReleaseFixture(subcontext);
      await writeFile(path.join(distDirectory, filename), contents);
      await assert.rejects(auditYouTubeArtifact(distDirectory), /(?:server secret|private key)/u);
    });
  }
});

test("artifact audit rejects stable unsupported-surface markers", async (context) => {
  const markers = [
    ["Race-to-10", "RaceTo10.TITLE", /Race-to-10 surface/u],
    ["leaderboard", "Leaderboard.TITLE", /leaderboard surface/u],
    ["account", "game:deleteAccount", /account or profile surface/u],
    ["profile", "Profile.TITLE", /account or profile surface/u],
    ["sharing", "shareAsync", /sharing surface/u],
    ["multiplayer", "MatchmakingService", /multiplayer surface/u],
  ];
  for (const [name, marker, expected] of markers) {
    await context.test(name, async (subcontext) => {
      const {distDirectory} = await createReleaseFixture(subcontext);
      await appendFile(path.join(distDirectory, "assets/app.js"), `const unsupported${name.length}='${marker}';\n`);
      await assert.rejects(auditYouTubeArtifact(distDirectory), expected);
    });
  }
});

test("artifact audit permits only the exact SDK entry and emitted React literals", async (context) => {
  const {distDirectory} = await createReleaseFixture(context);
  const vendorPath = path.join(distDirectory, "assets/vendor-react-fixture.js");
  await writeFile(vendorPath, [
    "const reactError='https://react.dev/errors/';",
    "const svg='http://www.w3.org/2000/svg';",
    "const math='http://www.w3.org/1998/Math/MathML';",
    "const xlink='http://www.w3.org/1999/xlink';",
    "const xml='http://www.w3.org/XML/1998/namespace';",
    "",
  ].join("\n"));
  await auditYouTubeArtifact(distDirectory);

  await appendFile(vendorPath, "const unapproved='https://react.dev/errors/404';\n");
  await assert.rejects(auditYouTubeArtifact(distDirectory), /unapproved external URL/u);
});


test("verification refuses source edits between release suites", async context => {
  const fixture = await createReleaseFixture(context);
  let calls = 0;
  await assert.rejects(runYouTubeReleaseVerification({
    repository: fixture.repositoryDirectory,
    distDirectory: fixture.distDirectory,
    contentAuditPath: fixture.contentAuditPath,
    reportPath: fixture.reportPath,
    commandRunner: async ({id}) => {
      if (++calls === 2) {
        await appendFile(path.join(fixture.repositoryDirectory, "source.txt"), "changed after content tests\n");
      }
      return {stdoutSha256: sha256(Buffer.from(id)), stderrSha256: sha256(Buffer.alloc(0))};
    },
  }), /source.*changed|changed.*source/iu);
  assert.equal(calls, 2);
  await assert.rejects(access(fixture.reportPath));
});

test("report writer refuses a source identity changed after suite verification", async context => {
  const fixture = await createReleaseFixture(context);
  const expectedSource = await captureSourceIdentity(fixture.repositoryDirectory);
  await appendFile(path.join(fixture.repositoryDirectory, "source.txt"), "edit before report write\n");
  await assert.rejects(fixture.writeReport({expectedSource}), /source tree changed/iu);
  await assert.rejects(access(fixture.reportPath));
});


test("generated verification outputs do not alter release source identity", async context => {
  const fixture = await createReleaseFixture(context);
  const original = await captureSourceIdentity(fixture.repositoryDirectory);
  const generated = ["artifacts/progress.json", ".codex/run.json"];
  for (const file of generated) {
    await mkdir(path.dirname(path.join(fixture.repositoryDirectory, file)), {recursive: true});
    await writeFile(path.join(fixture.repositoryDirectory, file), "generated output\n");
  }
  git(fixture.repositoryDirectory, ["add", ...generated]);
  assert.deepEqual(await captureSourceIdentity(fixture.repositoryDirectory), original);
  for (const file of generated) await appendFile(path.join(fixture.repositoryDirectory, file), "new output\n");
  assert.deepEqual(await captureSourceIdentity(fixture.repositoryDirectory), original);
});

test("source files in nested artifact-named folders remain source inputs", async context => {
  const fixture = await createReleaseFixture(context);
  const original = await captureSourceIdentity(fixture.repositoryDirectory);
  const file = path.join(fixture.repositoryDirectory, "packages/web-game/src/artifacts/model.ts");
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, "export const value = 1;\n");
  assert.notEqual((await captureSourceIdentity(fixture.repositoryDirectory)).snapshotSha256, original.snapshotSha256);
});
