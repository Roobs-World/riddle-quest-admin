import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createAcceptedUploadAttemptReceipt,
  createAmbiguousUploadReceipt,
  createGatedArtifactRecord,
  createPendingUploadReceipt,
  createTransmittingUploadReceipt,
  createUploadAttemptBarrier,
  getUploadAttemptReceiptPath,
  loadAndVerifyGatedArtifact,
  parseAcceptedUploadResponse,
  removeOwnedUploadAttemptBarrier,
  resolveAbsolutePathOverride,
  sha256,
  transitionUploadAttemptBarrier,
  writePrivateJson,
} from "./jest-upload-artifact.mjs";
import {
  assertAllowedReleaseCredentialFileKeys,
  BUBBLEWRAP_PATH,
  createReleaseChildEnvironment,
  createReleaseSandboxArguments,
  findUnresolvedUploadBarriers,
  fingerprintReleaseDependencies,
  getUnresolvedUploadBarrierPath,
  RIDDLE_QUEST_JEST_GAME_ID,
  resolveReleaseCredentialPath,
  resolveRiddleQuestJestGameId,
} from "./jest-release-safety.mjs";

const gameId = "019faa68-f3ec-755d-9ab5-c887fb426801";
const versionId = "019faa68-f3ec-755d-9ab5-c887fb426802";
const sourceCommit = "a".repeat(40);

test("the release identity is fixed to the Riddle Quest Jest game", () => {
  assert.equal(RIDDLE_QUEST_JEST_GAME_ID, gameId);
  assert.equal(resolveRiddleQuestJestGameId(undefined), gameId);
  assert.equal(resolveRiddleQuestJestGameId(gameId), gameId);
  assert.throws(
    () => resolveRiddleQuestJestGameId("019faa68-f3ec-755d-9ab5-c887fb426802"),
    /JEST_GAME_ID must equal 019faa68-f3ec-755d-9ab5-c887fb426801/,
  );
  assert.throws(() => resolveRiddleQuestJestGameId(""), /JEST_GAME_ID must equal/);
});

test("the upload gate binds the exact archive bytes, version, game and activation intent", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-upload-gate-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const archivePath = path.join(directory, "build.zip");
  const gateReceiptPath = path.join(directory, "receipts", "gated-artifact.json");
  const contents = Buffer.from("deterministic gated archive");
  await writeFile(archivePath, contents);
  const record = createGatedArtifactRecord({
    activationRequested: false,
    archiveBytes: contents.byteLength,
    archiveEntries: 2,
    archivePath,
    archiveSha256: sha256(contents),
    buildVersion: "1.0.0-test.1",
    gameId,
    sourceCommit,
    sourceDirty: false,
    gatedAt: new Date("2026-08-11T12:00:00.000Z"),
  });
  await writePrivateJson(gateReceiptPath, record);

  const verified = await loadAndVerifyGatedArtifact({
    activationRequested: false,
    archivePath,
    buildVersion: "1.0.0-test.1",
    gameId,
    gateReceiptPath,
    sourceCommit,
    sourceDirty: false,
  });
  assert.deepEqual(verified.contents, contents);

  await assert.rejects(
    loadAndVerifyGatedArtifact({
      activationRequested: true,
      archivePath,
      buildVersion: "1.0.0-test.1",
      gameId,
      gateReceiptPath,
      sourceCommit,
      sourceDirty: false,
    }),
    /activation intent/,
  );

  await writeFile(archivePath, Buffer.from("archive changed after its gate"));
  await assert.rejects(
    loadAndVerifyGatedArtifact({
      activationRequested: false,
      archivePath,
      buildVersion: "1.0.0-test.1",
      gameId,
      gateReceiptPath,
      sourceCommit,
      sourceDirty: false,
    }),
    /changed after its gate/,
  );
});

test("the upload gate rejects a different commit or dirty-state transition", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-upload-source-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const archivePath = path.join(directory, "build.zip");
  const gateReceiptPath = path.join(directory, "gated-artifact.json");
  const contents = Buffer.from("source-bound archive");
  await writeFile(archivePath, contents);
  await writePrivateJson(gateReceiptPath, createGatedArtifactRecord({
    activationRequested: false,
    archiveBytes: contents.byteLength,
    archiveEntries: 1,
    archivePath,
    archiveSha256: sha256(contents),
    buildVersion: "1.0.0-test.2",
    gameId,
    sourceCommit,
    sourceDirty: false,
  }));

  await assert.rejects(loadAndVerifyGatedArtifact({
    activationRequested: false,
    archivePath,
    buildVersion: "1.0.0-test.2",
    gameId,
    gateReceiptPath,
    sourceCommit: "b".repeat(40),
    sourceDirty: false,
  }), /source tree changed/);
  await assert.rejects(loadAndVerifyGatedArtifact({
    activationRequested: false,
    archivePath,
    buildVersion: "1.0.0-test.2",
    gameId,
    gateReceiptPath,
    sourceCommit,
    sourceDirty: true,
  }), /source tree changed/);
});

test("upload path overrides are absolute-only and preserve their defaults", () => {
  const fallback = path.join(tmpdir(), "riddle-quest-default-build.zip");
  assert.equal(resolveAbsolutePathOverride({
    fallback,
    name: "JEST_ARCHIVE_PATH",
    value: undefined,
  }), fallback);
  assert.equal(resolveAbsolutePathOverride({
    fallback,
    name: "JEST_ARCHIVE_PATH",
    value: "/tmp/riddle-quest-release/build.zip",
  }), "/tmp/riddle-quest-release/build.zip");
  assert.throws(() => resolveAbsolutePathOverride({
    fallback,
    name: "JEST_ARCHIVE_PATH",
    value: "",
  }), /nonempty absolute path/);
  assert.throws(() => resolveAbsolutePathOverride({
    fallback,
    name: "JEST_ARCHIVE_PATH",
    value: "relative/build.zip",
  }), /nonempty absolute path/);
});

test("release child processes receive only the allowlist and isolated runtime paths", () => {
  const childEnvironment = createReleaseChildEnvironment({
    CI: "true",
    HOME: "/home/release-operator",
    JEST_GAME_UPLOAD_TOKEN: "jest-secret",
    JEST_NOTIFICATION_EMAIL: "operator@example.com",
    JEST_RELEASE_CREDENTIALS_FILE: "/private/jest-release.env",
    LD_LIBRARY_PATH: "/untrusted/loader-path",
    NODE_EXTRA_CA_CERTS: "/untrusted/ca.pem",
    NPM_TOKEN: "registry-secret",
    PATH: "/release/bin",
    SENTRY_AUTH_TOKEN: "sentry-secret",
    SSL_CERT_DIR: "/untrusted/certificates",
    SSL_CERT_FILE: "/untrusted/certificate.pem",
    VITE_UNRELATED_PRIVATE_VALUE: "vite-secret",
    XDG_CONFIG_HOME: "/private/config",
  }, {
    isolatedHomeDirectory: "/tmp/release-sandbox/home",
    isolatedRuntimeDirectory: "/tmp/release-sandbox/runtime",
    isolatedTemporaryDirectory: "/tmp/release-sandbox/tmp",
  });

  assert.deepEqual(childEnvironment, {
    CI: "true",
    HOME: "/tmp/release-sandbox/home",
    PATH: "/release/bin",
    TEMP: "/tmp/release-sandbox/tmp",
    TMP: "/tmp/release-sandbox/tmp",
    TMPDIR: "/tmp/release-sandbox/tmp",
    XDG_RUNTIME_DIR: "/tmp/release-sandbox/runtime",
  });
  assert.throws(() => createReleaseChildEnvironment({HOME: "/home/release-operator"}, {
    isolatedHomeDirectory: "/tmp/release-sandbox/home",
    isolatedRuntimeDirectory: "/tmp/release-sandbox/runtime",
    isolatedTemporaryDirectory: "/tmp/release-sandbox/tmp",
  }), /PATH is required/);
});

test("Vite loads public browser values outside the portal root", async () => {
  const [viteConfiguration, publicEnvironment] = await Promise.all([
    readFile(new URL("../webTargetViteConfig.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../config/vite/portal/.env.jest", import.meta.url), "utf8"),
  ]);
  assert.match(
    viteConfiguration,
    /new URL\("\.\.\/\.\.\/config\/vite\/portal\/", import\.meta\.url\)/u,
  );
  assert.match(viteConfiguration, /envDir:\s*portalEnvironmentDirectory/u);
  const environmentKeys = publicEnvironment
    .split(/\r?\n/u)
    .map((line) => /^([A-Za-z_][A-Za-z0-9_]*)=/u.exec(line)?.[1])
    .filter(Boolean);
  assert.ok(environmentKeys.length > 0);
  assert.ok(environmentKeys.every((key) => key.startsWith("VITE_")));
  for (const legacyEnvironment of [
    ".env",
    ".env.local",
    ".env.jest",
    ".env.jest.local",
    ".env.jest-upload.local",
  ]) {
    await assert.rejects(stat(new URL(`../${legacyEnvironment}`, import.meta.url)), {code: "ENOENT"});
  }
});

test("release sandbox mount order hides credentials and preserves read-only provenance", () => {
  const sandboxArguments = createReleaseSandboxArguments({
    additionalMaskedFilePaths: ["/home/release-operator/source/riddle-quest/.env"],
    args: ["release-child.mjs", "--check"],
    command: "/runtime/node/bin/node",
    credentialPath: "/home/release-operator/.config/riddle-quest/jest-release.env",
    gitMetadataPaths: ["/home/release-operator/source/riddle-quest/.git"],
    operatorHomeDirectory: "/home/release-operator",
    readOnlyBinds: [
      {source: "/runtime/node", destination: "/home/release-operator/.nvm/node"},
      {
        source: "/home/release-operator/.cache/ms-playwright",
        destination: "/tmp/release-sandbox/home/.cache/ms-playwright",
      },
    ],
    repositoryDirectory: "/home/release-operator/source/riddle-quest",
    sandboxDirectory: "/tmp/release-sandbox",
    workingDirectory: "/home/release-operator/source/riddle-quest/packages/portal",
  });
  const sequenceIndex = (...values) => {
    for (let index = 0; index <= sandboxArguments.length - values.length; index += 1) {
      if (values.every((value, offset) => sandboxArguments[index + offset] === value)) return index;
    }
    return -1;
  };

  const rootReadOnlyIndex = sequenceIndex("--ro-bind", "/", "/");
  const privateProcIndex = sequenceIndex("--proc", "/proc");
  const namespaceIndex = sequenceIndex("--unshare-all");
  const sharedNetworkIndex = sequenceIndex("--share-net");
  const capabilityIndex = sequenceIndex("--cap-drop", "ALL");
  const homeMaskIndex = sequenceIndex("--perms", "0700", "--tmpfs", "/home/release-operator");
  const temporaryMaskIndex = sequenceIndex("--perms", "1777", "--tmpfs", "/tmp");
  const sandboxParentIndex = sequenceIndex("--dir", "/tmp");
  const sandboxBindIndex = sequenceIndex("--bind", "/tmp/release-sandbox", "/tmp/release-sandbox");
  const nodeParentIndex = sequenceIndex("--dir", "/home/release-operator/.nvm");
  const nodeBindIndex = sequenceIndex("--ro-bind", "/runtime/node", "/home/release-operator/.nvm/node");
  const cacheParentIndex = sequenceIndex("--dir", "/tmp/release-sandbox/home/.cache");
  const cacheBindIndex = sequenceIndex(
    "--ro-bind",
    "/home/release-operator/.cache/ms-playwright",
    "/tmp/release-sandbox/home/.cache/ms-playwright",
  );
  const repositoryParentIndex = sequenceIndex("--dir", "/home/release-operator/source");
  const repositoryBindIndex = sequenceIndex(
    "--bind",
    "/home/release-operator/source/riddle-quest",
    "/home/release-operator/source/riddle-quest",
  );
  const gitReadOnlyIndex = sequenceIndex(
    "--ro-bind",
    "/home/release-operator/source/riddle-quest/.git",
    "/home/release-operator/source/riddle-quest/.git",
  );
  const credentialMaskIndex = sequenceIndex(
    "--ro-bind",
    "/dev/null",
    "/home/release-operator/.config/riddle-quest/jest-release.env",
  );
  const legacyEnvironmentMaskIndex = sequenceIndex(
    "--ro-bind",
    "/dev/null",
    "/home/release-operator/source/riddle-quest/.env",
  );
  const credentialParentIndex = sequenceIndex(
    "--dir",
    "/home/release-operator/.config/riddle-quest",
  );
  const commandIndex = sequenceIndex("--", "/runtime/node/bin/node", "release-child.mjs", "--check");

  assert.ok([
    rootReadOnlyIndex,
    privateProcIndex,
    namespaceIndex,
    sharedNetworkIndex,
    capabilityIndex,
    homeMaskIndex,
    temporaryMaskIndex,
    sandboxParentIndex,
    sandboxBindIndex,
    nodeParentIndex,
    nodeBindIndex,
    cacheParentIndex,
    cacheBindIndex,
    repositoryParentIndex,
    repositoryBindIndex,
    gitReadOnlyIndex,
    legacyEnvironmentMaskIndex,
    credentialMaskIndex,
    credentialParentIndex,
    commandIndex,
  ].every((index) => index >= 0));
  assert.ok(rootReadOnlyIndex < homeMaskIndex);
  assert.ok(homeMaskIndex < temporaryMaskIndex);
  assert.ok(temporaryMaskIndex < sandboxParentIndex && sandboxParentIndex < sandboxBindIndex);
  assert.ok(sandboxBindIndex < nodeParentIndex && nodeParentIndex < nodeBindIndex);
  assert.ok(nodeBindIndex < cacheParentIndex && cacheParentIndex < cacheBindIndex);
  assert.ok(cacheBindIndex < repositoryParentIndex && repositoryParentIndex < repositoryBindIndex);
  assert.ok(repositoryBindIndex < gitReadOnlyIndex);
  assert.ok(gitReadOnlyIndex < legacyEnvironmentMaskIndex);
  assert.ok(legacyEnvironmentMaskIndex < credentialParentIndex && credentialParentIndex < credentialMaskIndex);
  assert.ok(credentialMaskIndex < commandIndex);
  assert.ok(namespaceIndex < sharedNetworkIndex);
  assert.equal(BUBBLEWRAP_PATH, "/usr/bin/bwrap");
  assert.equal(sequenceIndex("--unshare-net"), -1);
});

test("post-gate sandbox protects source and artifact while only receipts remain writable", () => {
  const repository = "/workspace/riddle-quest";
  const receiptDirectory = `${repository}/packages/portal/.jest-upload-receipts`;
  const gateReceipt = `${receiptDirectory}/build.gated.json`;
  const sandboxArguments = createReleaseSandboxArguments({
    additionalMaskedDirectoryPaths: [receiptDirectory],
    args: ["trusted-uploader.mjs"],
    command: "/usr/bin/node",
    credentialPath: "/home/operator/.config/riddle-quest/jest-release.env",
    gitMetadataPaths: [`${repository}/.git`],
    operatorHomeDirectory: "/home/operator",
    protectedReadOnlyBinds: [
      {source: "/tmp/release/source", destination: "/tmp/release/source"},
      {source: gateReceipt, destination: gateReceipt},
    ],
    readOnlyBinds: [],
    repositoryDirectory: repository,
    repositoryReadOnly: true,
    sandboxDirectory: "/tmp/release",
    workingDirectory: `${repository}/packages/portal`,
    writableBinds: [{source: receiptDirectory, destination: receiptDirectory}],
  });
  const sequenceIndex = (...values) => {
    for (let index = 0; index <= sandboxArguments.length - values.length; index += 1) {
      if (values.every((value, offset) => sandboxArguments[index + offset] === value)) return index;
    }
    return -1;
  };

  const repositoryReadOnly = sequenceIndex("--ro-bind", repository, repository);
  const receiptsMasked = sequenceIndex("--perms", "0700", "--tmpfs", receiptDirectory);
  const receiptsWritable = sequenceIndex("--bind", receiptDirectory, receiptDirectory);
  const gitReadOnly = sequenceIndex("--ro-bind", `${repository}/.git`, `${repository}/.git`);
  const sourceReadOnly = sequenceIndex("--ro-bind", "/tmp/release/source", "/tmp/release/source");
  const gateReadOnly = sequenceIndex("--ro-bind", gateReceipt, gateReceipt);
  assert.ok(repositoryReadOnly >= 0);
  assert.ok(repositoryReadOnly < receiptsMasked);
  assert.ok(receiptsMasked < receiptsWritable);
  assert.ok(receiptsWritable < gitReadOnly);
  assert.ok(gitReadOnly < sourceReadOnly);
  assert.ok(sourceReadOnly < gateReadOnly);
});

test("persistent release credentials cannot retain activation intent", async () => {
  assert.doesNotThrow(() => assertAllowedReleaseCredentialFileKeys([
    "JEST_GAME_ID",
    "JEST_GAME_UPLOAD_TOKEN",
    "JEST_NOTIFICATION_EMAIL",
    "SENTRY_UPLOAD_SOURCEMAPS",
  ]));
  for (const key of ["JEST_UPLOAD_IS_ACTIVE", "JEST_CONFIRM_ACTIVATION"]) {
    assert.throws(
      () => assertAllowedReleaseCredentialFileKeys(["JEST_GAME_UPLOAD_TOKEN", key]),
      new RegExp(`Unsupported Jest release credential file keys: ${key}`),
    );
  }
  const credentialTemplate = await readFile(
    new URL("../jest-release.credentials.example", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(credentialTemplate, /^JEST_(?:UPLOAD_IS_ACTIVE|CONFIRM_ACTIVATION)=/mu);
});

test("release credentials honor XDG_CONFIG_HOME without exposing it to child processes", () => {
  assert.equal(resolveReleaseCredentialPath({
    homeDirectory: "/home/release-operator",
  }), "/home/release-operator/.config/riddle-quest/jest-release.env");
  assert.equal(resolveReleaseCredentialPath({
    homeDirectory: "/home/release-operator",
    xdgConfigHome: "/private/xdg-config",
  }), "/private/xdg-config/riddle-quest/jest-release.env");
  assert.equal(resolveReleaseCredentialPath({
    explicitPath: "/private/custom.env",
    homeDirectory: "/home/release-operator",
    xdgConfigHome: "/private/xdg-config",
  }), "/private/custom.env");
  assert.throws(() => resolveReleaseCredentialPath({
    homeDirectory: "/home/release-operator",
    xdgConfigHome: "relative/config",
  }), /XDG_CONFIG_HOME must be a nonempty absolute path/);
  assert.throws(() => resolveReleaseCredentialPath({
    explicitPath: "",
    homeDirectory: "/home/release-operator",
  }), /JEST_RELEASE_CREDENTIALS_FILE must be nonempty/);
});

test("dependency fingerprints detect tooling changes but ignore known build caches", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-release-dependencies-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  await Promise.all([
    mkdir(path.join(directory, "node_modules"), {recursive: true}),
    mkdir(path.join(directory, "firebase-functions", "node_modules"), {recursive: true}),
    mkdir(path.join(directory, "firebase-functions", "packages", "core"), {recursive: true}),
    mkdir(path.join(directory, "packages", "core", "node_modules"), {recursive: true}),
    mkdir(path.join(directory, "packages", "portal", "node_modules"), {recursive: true}),
  ]);
  for (const [relativePath, contents] of [
    ["package.json", "{\"name\":\"fixture\"}\n"],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["pnpm-workspace.yaml", "packages: ['packages/*']\n"],
    [path.join("firebase-functions", "package.json"), "{\"name\":\"functions\"}\n"],
    [path.join("firebase-functions", "package-lock.json"), "{\"lockfileVersion\":3}\n"],
    [path.join("firebase-functions", "packages", "core", "package.json"), "{\"name\":\"functions-core\"}\n"],
    [path.join("packages", "core", "package.json"), "{\"name\":\"core\"}\n"],
    [path.join("packages", "portal", "package.json"), "{\"name\":\"portal\"}\n"],
    [path.join("node_modules", "release-tool.js"), "export default 'stable';\n"],
    [path.join("firebase-functions", "node_modules", "functions-runtime.js"), "functions-runtime\n"],
    [path.join("packages", "core", "node_modules", "compiler.js"), "core-compiler\n"],
    [path.join("packages", "portal", "node_modules", "bundler.js"), "portal-bundler\n"],
  ]) {
    await writeFile(path.join(directory, relativePath), contents);
  }

  const initial = fingerprintReleaseDependencies({repositoryDirectory: directory});
  assert.equal(fingerprintReleaseDependencies({repositoryDirectory: directory}), initial);
  await writeFile(path.join(directory, "node_modules", "release-tool.js"), "export default 'changed';\n");
  assert.notEqual(fingerprintReleaseDependencies({repositoryDirectory: directory}), initial);
  await writeFile(path.join(directory, "node_modules", "release-tool.js"), "export default 'stable';\n");
  assert.equal(fingerprintReleaseDependencies({repositoryDirectory: directory}), initial);

  const cacheDirectory = path.join(directory, "packages", "portal", "node_modules", ".vite");
  await mkdir(cacheDirectory);
  await writeFile(path.join(cacheDirectory, "generated-cache.js"), "mutable cache\n");
  assert.equal(fingerprintReleaseDependencies({repositoryDirectory: directory}), initial);
});

test("the game-and-build upload barrier is atomic, owner-private, and blocks retries", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-upload-barrier-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const receiptDirectory = path.join(directory, "receipts");
  const buildVersion = "1.0.0-test.barrier";
  const artifact = {
    archive: {file: "build.zip", bytes: 42, sha256: "a".repeat(64), entries: 2},
  };
  const receipt = createTransmittingUploadReceipt({
    activationRequested: false,
    artifact,
    attemptedAt: new Date("2026-08-11T12:00:00.000Z"),
    attemptId: versionId,
    buildVersion,
    gameId,
    sourceCommit,
  });
  const competingReceipt = {...receipt, attemptId: gameId};
  const receiptPath = getUploadAttemptReceiptPath({buildVersion, gameId, receiptDirectory});
  const otherBuildPath = getUploadAttemptReceiptPath({
    buildVersion: `${buildVersion}.other`,
    gameId,
    receiptDirectory,
  });
  assert.notEqual(receiptPath, otherBuildPath);
  assert.equal(getUploadAttemptReceiptPath({
    buildVersion,
    gameId: gameId.toUpperCase(),
    receiptDirectory,
  }), receiptPath);

  const competingCreates = await Promise.allSettled([
    createUploadAttemptBarrier({receipt, receiptPath}),
    createUploadAttemptBarrier({receipt: competingReceipt, receiptPath}),
  ]);
  assert.equal(competingCreates.filter(({status}) => status === "fulfilled").length, 1);
  const rejectedCreate = competingCreates.find(({status}) => status === "rejected");
  assert.match(rejectedCreate.reason.message, /Unsafe Jest upload retry blocked/);
  const persisted = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.deepEqual(persisted, persisted.attemptId === receipt.attemptId ? receipt : competingReceipt);
  assert.equal((await stat(receiptPath)).mode & 0o777, 0o600);
  assert.equal((await stat(receiptDirectory)).mode & 0o777, 0o700);
  await assert.rejects(
    createUploadAttemptBarrier({receipt: {...receipt, attemptId: gameId}, receiptPath}),
    /Unsafe Jest upload retry blocked/,
  );
});

test("the game-and-source barrier blocks new build versions until manual reconciliation", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-source-barrier-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const artifact = {
    archive: {file: "build.zip", bytes: 42, sha256: "c".repeat(64), entries: 2},
  };
  const sourceBarrierPath = getUnresolvedUploadBarrierPath({
    gameId,
    receiptDirectory: directory,
    sourceCommit,
  });
  assert.equal(getUnresolvedUploadBarrierPath({
    gameId: gameId.toUpperCase(),
    receiptDirectory: directory,
    sourceCommit,
  }), sourceBarrierPath);
  const firstBuild = createTransmittingUploadReceipt({
    activationRequested: false,
    artifact,
    attemptId: versionId,
    buildVersion: "1.0.0-test.source-first",
    gameId,
    sourceCommit,
  });
  const nextBuild = createTransmittingUploadReceipt({
    activationRequested: false,
    artifact,
    attemptId: gameId,
    buildVersion: "1.0.0-test.source-next",
    gameId,
    sourceCommit,
  });

  await createUploadAttemptBarrier({receipt: firstBuild, receiptPath: sourceBarrierPath});
  await assert.rejects(
    createUploadAttemptBarrier({receipt: nextBuild, receiptPath: sourceBarrierPath}),
    /Unsafe Jest upload retry blocked/,
  );
  assert.deepEqual(findUnresolvedUploadBarriers({
    receiptDirectory: directory,
    sourceCommit,
  }), [sourceBarrierPath]);
  assert.deepEqual(findUnresolvedUploadBarriers({
    receiptDirectory: directory,
    sourceCommit: "b".repeat(40),
  }), []);
  assert.notEqual(getUnresolvedUploadBarrierPath({
    gameId: versionId,
    receiptDirectory: directory,
    sourceCommit,
  }), sourceBarrierPath);

  const ambiguous = createAmbiguousUploadReceipt({
    attempt: firstBuild,
    reason: "request-failed-before-authoritative-response",
  });
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: ambiguous,
    receiptPath: sourceBarrierPath,
  });
  await assert.rejects(removeOwnedUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: firstBuild,
    receiptPath: sourceBarrierPath,
  }), /changed unexpectedly/);
  assert.deepEqual(findUnresolvedUploadBarriers({
    receiptDirectory: directory,
    sourceCommit,
  }), [sourceBarrierPath]);
});

test("an accepted source barrier remains until an explicit reconciled removal", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-source-barrier-cleanup-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const receiptPath = getUnresolvedUploadBarrierPath({
    gameId,
    receiptDirectory: directory,
    sourceCommit,
  });
  const receipt = createTransmittingUploadReceipt({
    activationRequested: false,
    artifact: {archive: {file: "build.zip", bytes: 84, sha256: "d".repeat(64), entries: 4}},
    attemptId: versionId,
    buildVersion: "1.0.0-test.cleanup",
    gameId,
    sourceCommit,
  });
  await createUploadAttemptBarrier({receipt, receiptPath});
  const acceptedReceipt = createAcceptedUploadAttemptReceipt({
    attempt: receipt,
    buildStatus: "processing",
    versionId,
  });
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: acceptedReceipt,
    receiptPath,
  });
  assert.equal(JSON.parse(await readFile(receiptPath, "utf8")).state, "accepted");
  assert.deepEqual(findUnresolvedUploadBarriers({
    receiptDirectory: directory,
    sourceCommit,
  }), [receiptPath]);
  await assert.rejects(removeOwnedUploadAttemptBarrier({
    expectedState: "accepted",
    receipt: {...acceptedReceipt, attemptId: gameId},
    receiptPath,
  }), /changed unexpectedly/);
  await removeOwnedUploadAttemptBarrier({
    expectedState: "accepted",
    receipt: acceptedReceipt,
    receiptPath,
  });
  await assert.rejects(stat(receiptPath), {code: "ENOENT"});
});

test("upload attempt barriers transition from transmitting to ambiguous or accepted", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-upload-states-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const artifact = {
    archive: {file: "build.zip", bytes: 84, sha256: "b".repeat(64), entries: 3},
  };
  const createAttempt = (buildVersion, attemptId) => createTransmittingUploadReceipt({
    activationRequested: true,
    artifact,
    attemptedAt: new Date("2026-08-11T12:00:00.000Z"),
    attemptId,
    buildVersion,
    gameId,
    sourceCommit,
  });

  const ambiguousAttempt = createAttempt("1.0.0-test.ambiguous", gameId);
  const ambiguousPath = getUploadAttemptReceiptPath({
    buildVersion: ambiguousAttempt.buildVersion,
    gameId,
    receiptDirectory: directory,
  });
  await createUploadAttemptBarrier({receipt: ambiguousAttempt, receiptPath: ambiguousPath});
  const ambiguousReceipt = createAmbiguousUploadReceipt({
    ambiguousAt: new Date("2026-08-11T12:01:00.000Z"),
    attempt: ambiguousAttempt,
    reason: "request-failed-before-authoritative-response",
  });
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: ambiguousReceipt,
    receiptPath: ambiguousPath,
  });
  assert.equal(JSON.parse(await readFile(ambiguousPath, "utf8")).state, "ambiguous");
  await assert.rejects(transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: createAcceptedUploadAttemptReceipt({
      attempt: ambiguousAttempt,
      buildStatus: "processing",
      versionId,
    }),
    receiptPath: ambiguousPath,
  }), /changed unexpectedly/);

  const acceptedAttempt = createAttempt("1.0.0-test.accepted", versionId);
  const acceptedPath = getUploadAttemptReceiptPath({
    buildVersion: acceptedAttempt.buildVersion,
    gameId,
    receiptDirectory: directory,
  });
  await createUploadAttemptBarrier({receipt: acceptedAttempt, receiptPath: acceptedPath});
  const acceptedReceipt = createAcceptedUploadAttemptReceipt({
    acceptedAt: new Date("2026-08-11T12:02:00.000Z"),
    attempt: acceptedAttempt,
    buildStatus: "processing",
    versionId,
  });
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: acceptedReceipt,
    receiptPath: acceptedPath,
  });
  const persistedAccepted = JSON.parse(await readFile(acceptedPath, "utf8"));
  assert.equal(persistedAccepted.state, "accepted");
  assert.equal(persistedAccepted.readiness, "pending");
  assert.equal(persistedAccepted.versionId, versionId);
  await assert.rejects(
    createUploadAttemptBarrier({receipt: acceptedAttempt, receiptPath: acceptedPath}),
    /Unsafe Jest upload retry blocked/,
  );
});

test("only the documented HTTP 202 processing response is accepted", () => {
  assert.deepEqual(
    parseAcceptedUploadResponse(202, JSON.stringify({versionId, buildStatus: "processing"})),
    {versionId, buildStatus: "processing"},
  );
  assert.deepEqual(
    parseAcceptedUploadResponse(202, JSON.stringify({
      versionId: versionId.toUpperCase(),
      buildStatus: "processing",
    })),
    {versionId, buildStatus: "processing"},
  );
  assert.throws(() => parseAcceptedUploadResponse(200, "{}"), /HTTP 200/);
  assert.throws(
    () => parseAcceptedUploadResponse(202, JSON.stringify({versionId, buildStatus: "ready"})),
    /buildStatus=processing/,
  );
  assert.throws(() => parseAcceptedUploadResponse(202, "not-json"), /invalid JSON/);
});

test("the persisted 202 receipt remains pending until an authoritative Jest confirmation", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-upload-receipt-"));
  context.after(async () => {
    const {rm} = await import("node:fs/promises");
    await rm(directory, {force: true, recursive: true});
  });
  const receiptPath = path.join(directory, "pending.json");
  const receipt = createPendingUploadReceipt({
    acceptedAt: new Date("2026-08-11T12:00:00.000Z"),
    activationRequested: false,
    artifact: {archive: {file: "build.zip", bytes: 42, sha256: "a".repeat(64)}},
    buildStatus: "processing",
    buildVersion: "1.0.0-test.1",
    gameId,
    sourceCommit,
    versionId,
  });
  await writePrivateJson(receiptPath, receipt);

  assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), receipt);
  assert.equal(receipt.readiness, "pending");
  assert.deepEqual(receipt.source, {commit: sourceCommit, dirty: false});
  assert.equal(receipt.verification.automatedPolling, false);
});

test("the release sequence gates, packages, verifies, and uploads one immutable artifact", async () => {
  const [artifactSource, releaseSafetySource, releaseSource, uploadSource, viteSource] = await Promise.all([
    readFile(new URL("./jest-upload-artifact.mjs", import.meta.url), "utf8"),
    readFile(new URL("./jest-release-safety.mjs", import.meta.url), "utf8"),
    readFile(new URL("./release-jest-timestamped.mjs", import.meta.url), "utf8"),
    readFile(new URL("./upload-jest-build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../webTargetViteConfig.ts", import.meta.url), "utf8"),
  ]);

  const findAfter = (pattern, start = 0) => {
    if (start < 0) return -1;
    const match = releaseSource.slice(start).match(pattern);
    return match ? start + match.index : -1;
  };
  const earlyIdentityIndex = findAfter(/resolveRiddleQuestJestGameId\(process\.env\.JEST_GAME_ID\)/);
  const sandboxProbeIndex = findAfter(/assertReleaseSandboxAvailable\(\);/, earlyIdentityIndex);
  const sandboxedGitIndex = findAfter(/sourceCommit\s*=\s*readGit\(\["rev-parse",\s*"HEAD"\]\)/, sandboxProbeIndex);
  const unresolvedBarrierIndex = findAfter(
    /const unresolvedUploadBarriers\s*=\s*findUnresolvedUploadBarriers/,
    sandboxedGitIndex,
  );
  const dependencyCaptureIndex = findAfter(
    /const dependencyFingerprint\s*=\s*fingerprintReleaseDependencies/,
    unresolvedBarrierIndex,
  );
  const consoleReadinessIndex = findAfter(
    /\[\s*["']--filter["']\s*,\s*["']@qwordly\/portal["']\s*,\s*["']check:jest-console:release["']\s*\]/,
    dependencyCaptureIndex,
  );
  const gateIndex = findAfter(/\[\s*["']verify:production:extended["']\s*\]/, consoleReadinessIndex);
  const materializeIndex = findAfter(/materializeCommittedSource\s*\(\s*\)\s*;/, gateIndex);
  const credentialLoadIndex = findAfter(/const credentials\s*=\s*loadReleaseCredentials\(\)/, materializeIndex);
  const viteBuildIndex = findAfter(
    /\[\s*["']build["']\s*,\s*["']--mode["']\s*,\s*["']jest["']\s*,\s*["']--outDir["']\s*,\s*releaseBuildDirectory/,
    materializeIndex,
  );
  const dryPackageIndex = findAfter(/JEST_UPLOAD_DRY_RUN\s*:\s*["']true["']/, viteBuildIndex);
  const unzipIndex = findAfter(/run\s*\(\s*["']\/usr\/bin\/unzip["']/, dryPackageIndex);
  const readOnlyIndex = findAfter(/makeReadOnly\s*\(\s*verifiedBuildDirectory\s*\)\s*;/, unzipIndex);
  const extractedAuditIndex = findAfter(/trustedScript\(["']audit-jest-artifact\.mjs["']\)/, readOnlyIndex);
  const extractedW3cIndex = findAfter(/trustedScript\(["']validate-w3c\.mjs["']\)/, extractedAuditIndex);
  const browserIndex = findAfter(/resolveJestCli\(\)/, extractedW3cIndex);
  const dependencyVerifyIndex = findAfter(
    /const finalDependencyFingerprint\s*=\s*fingerprintReleaseDependencies/,
    browserIndex,
  );
  const uploadIndex = findAfter(/uploadEnvironment\s*,/, dependencyVerifyIndex);
  const orderedStages = [
    earlyIdentityIndex,
    sandboxProbeIndex,
    sandboxedGitIndex,
    unresolvedBarrierIndex,
    dependencyCaptureIndex,
    consoleReadinessIndex,
    gateIndex,
    materializeIndex,
    credentialLoadIndex,
    viteBuildIndex,
    dryPackageIndex,
    unzipIndex,
    readOnlyIndex,
    extractedAuditIndex,
    extractedW3cIndex,
    browserIndex,
    dependencyVerifyIndex,
    uploadIndex,
  ];
  assert.ok(orderedStages.every((index) => index >= 0), "every immutable release stage must be present");
  assert.deepEqual([...orderedStages].sort((left, right) => left - right), orderedStages);
  assert.doesNotMatch(
    releaseSource.slice(dryPackageIndex, uploadIndex),
    /\[\s*["']build["']\s*,\s*["']--mode["']\s*,\s*["']jest["']/,
  );

  const materializer = releaseSource.slice(
    releaseSource.indexOf("const materializeCommittedSource"),
    releaseSource.indexOf("const resolveViteCli"),
  );
  assert.match(materializer, /run\(gitExecutable,\s*\["archive"/);
  assert.match(materializer, /sourceCommit/);
  assert.match(materializer, /immutableSourceDirectory/);
  assert.match(materializer, /run\("\/usr\/bin\/tar"/);
  assert.match(releaseSource, /openSync\(lockPath,\s*"wx",\s*0o600\)/);
  assert.match(releaseSource, /finally\s*\{\s*releaseLock\(\);/);
  assert.match(releaseSource, /finalDependencyFingerprint !== dependencyFingerprint/);
  assert.match(releaseSource, /snapshotTrustedReleaseScripts\(\);/);
  assert.match(releaseSource, /["']web-target-artifact-inventory\.mjs["']/);
  assert.match(releaseSource, /releaseSandboxConfiguration\.repositoryReadOnly = true/);
  assert.match(releaseSource, /protectedReadOnlyBinds\.push\([\s\S]*archivePath[\s\S]*gateReceiptPath/);
  assert.match(releaseSource, /assertFileFingerprint\(archivePath, verifiedArchiveFingerprint/);
  assert.match(releaseSource, /assertFileFingerprint\(gateReceiptPath, verifiedGateReceiptFingerprint/);
  assert.match(releaseSource, /JEST_EXPECTED_ARCHIVE_SHA256 = verifiedArchiveFingerprint\.sha256/);
  assert.match(releaseSource, /JEST_EXPECTED_ARCHIVE_BYTES = String\(verifiedArchiveFingerprint\.bytes\)/);
  assert.match(releaseSource, /trustedScript\(["']upload-jest-build\.mjs["']\)/);
  assert.match(releaseSource, /["']--configLoader["']\s*,\s*["']runner["']/);
  assert.equal(
    [...releaseSource.matchAll(
      /trustedScript\(["']audit-jest-artifact\.mjs["']\),\s*\[[^\]]+\],\s*artifactEnvironment/g,
    )].length,
    2,
    "both immutable artifact audits must receive the absolute Console manifest binding",
  );
  assert.match(releaseSource, /const resolveTypeScriptCli\s*=\s*\(\)\s*=>/);
  assert.match(releaseSource, /runNode\(\s*resolveTypeScriptCli\(\),\s*\[["']-p["']/);
  assert.doesNotMatch(releaseSource, /runPnpm\(\[["']exec["'],\s*["']tsc["']/);
  assert.match(releaseSource, /const resolveJestCli\s*=\s*\(\)\s*=>/);
  assert.match(releaseSource, /PORTAL_BROWSER_TESTS:\s*["']1["']/);
  assert.match(releaseSource, /hostedBrowser\.jest-playwright\.test\.ts/);
  assert.match(releaseSource, /authentication\.jest-playwright\.test\.ts/);
  assert.doesNotMatch(releaseSource, /runPnpm\(\s*\[["']test:jest-local:playwright["']/);
  assert.match(
    releaseSource,
    /"ls-files",\s*"--others",\s*"--ignored",\s*"--exclude-standard",\s*"-z",\s*"--",\s*":\(glob\)\*\*\/\.env",\s*":\(glob\)\*\*\/\.env\.\*"/,
  );
  assert.match(releaseSource, /additionalMaskedFilePaths\.push\(\.\.\.ignoredEnvironmentPaths\)/);
  assert.match(releaseSource, /timestamped Jest releases are inactive-only/);
  assert.match(releaseSource, /const activationRequested = false/);
  assert.doesNotMatch(releaseSource, /credentials\.JEST_UPLOAD_IS_ACTIVE === ["']true["']/);
  assert.match(releaseSource, /additionalMaskedDirectoryPaths:\s*ignoredSensitiveDirectoryPaths/);

  const gateEnvironment = releaseSource.slice(
    releaseSource.indexOf("const gateEnvironment ="),
    releaseSource.indexOf("const runPnpm ="),
  );
  assert.match(releaseSource, /const releaseChildEnvironment = createReleaseChildEnvironment\(process\.env,\s*\{/);
  assert.match(gateEnvironment, /\.\.\.releaseChildEnvironment/);
  assert.doesNotMatch(releaseSource, /withoutPrivateBuildCredentials/);
  for (const credential of [
    "JEST_GAME_UPLOAD_TOKEN",
    "JEST_NOTIFICATION_EMAIL",
    "JEST_RELEASE_CREDENTIALS_FILE",
    "SENTRY_AUTH_TOKEN",
    "NPM_TOKEN",
    "XDG_CONFIG_HOME",
  ]) {
    assert.doesNotMatch(gateEnvironment, new RegExp(`${credential}\\s*:`));
  }
  assert.match(releaseSafetySource, /const childEnvironmentKeys = \[/);
  assert.match(releaseSafetySource, /export const BUBBLEWRAP_PATH = ["']\/usr\/bin\/bwrap["']/);
  assert.match(releaseSource, /spawnSync\(BUBBLEWRAP_PATH,/);
  assert.doesNotMatch(releaseSource, /spawnSync\(\s*(?:["']git["']|gitExecutable)/u);
  assert.match(releaseSource, /const result = run\(gitExecutable,/);
  assert.match(releaseSource, /"-c",\s*"core\.fsmonitor=false"/);
  assert.match(releaseSource, /"-c",\s*"core\.hooksPath=\/dev\/null"/);
  assert.match(uploadSource, /const gitExecutable = ["']\/usr\/bin\/git["']/);
  const uploaderGitReader = uploadSource.slice(
    uploadSource.indexOf("const gitEnvironment ="),
    uploadSource.indexOf("const sourceCommit ="),
  );
  assert.match(uploaderGitReader, /GIT_CONFIG_NOSYSTEM:\s*["']1["']/);
  assert.match(uploaderGitReader, /GIT_CONFIG_GLOBAL:\s*["']\/dev\/null["']/);
  assert.match(uploaderGitReader, /GIT_CONFIG_COUNT:\s*["']0["']/);
  assert.match(uploaderGitReader, /GIT_OPTIONAL_LOCKS:\s*["']0["']/);
  assert.match(uploaderGitReader, /spawnSync\(gitExecutable,/);
  assert.match(uploaderGitReader, /"-c",\s*"core\.fsmonitor=false"/);
  assert.match(uploaderGitReader, /"-c",\s*"core\.hooksPath=\/dev\/null"/);
  assert.match(uploaderGitReader, /env:\s*gitEnvironment/);
  assert.doesNotMatch(uploaderGitReader, /spawnSync\(["']git["']/);
  assert.doesNotMatch(uploaderGitReader, /env:\s*process\.env/);
  assert.match(uploadSource, /readFileSync\(0,\s*["']utf8["']\)/);
  assert.doesNotMatch(uploadSource, /closeSync\(0\)/);
  assert.match(uploadSource, /ambientUploadToken !== undefined/);
  assert.match(uploadSource, /JEST_GAME_UPLOAD_TOKEN must be delivered through the sandboxed release pipe/);
  assert.match(uploadSource, /spawnSync\(["']\/usr\/bin\/unzip["']/);
  assert.match(uploadSource, /spawnSync\(["']\/usr\/bin\/zip["']/);
  assert.match(releaseSource, /credentialPath:\s*canonicalCredentialPath/);
  assert.match(releaseSource, /gitMetadataPaths:\s*uniqueGitMetadataPaths/);
  assert.match(releaseSource, /additionalMaskedFilePaths:\s*ignoredSensitiveFilePaths/);
  assert.match(releaseSource, /const releaseDebugLogQuarantineDirectory = join\(/);
  assert.match(releaseSource, /renameSync\(destination, quarantinePath\)/);
  assert.match(releaseSource, /writableBinds:\s*\[\]/);
  assert.match(
    releaseSource,
    /const restoreQuarantinedReleaseDebugLogs = \(\) => \{[\s\S]*renameSync\(quarantinePath, destination\)/,
  );
  assert.match(
    releaseSource,
    /makeSandboxDirectoriesWritable\(releaseSandboxDirectory\);[\s\S]*rmSync\(releaseSandboxDirectory, \{force: true, recursive: true\}\)/,
  );
  assert.match(
    releaseSource,
    /runPnpm\(\["verify:production:extended"\][\s\S]*clearFreshReleaseDebugLogs\(\)/,
  );
  assert.match(releaseSource, /firebase\|firestore\)-debug\(\?:\\\.\\d\+\)\?\\\.log/);
  assert.match(
    releaseSource,
    /operatorFirebaseEmulatorCache[\s\S]*\.cache["'],\s*["']firebase["'],\s*["']emulators["'][\s\S]*cpSync\(operatorFirebaseEmulatorCache, isolatedFirebaseEmulatorCache, \{recursive: true\}\)/,
  );
  assert.match(
    releaseSource,
    /node_modules["'],\s*["']\.modules\.yaml["'][\s\S]*operatorPnpmStoreDirectory[\s\S]*copyFileSync\(operatorPnpmStoreIndexPath[\s\S]*addReadOnlyDirectoryBind\([\s\S]*operatorPnpmStoreFilesDirectory/,
  );
  assert.doesNotMatch(releaseSource, /pnpm_config_store_dir:\s*operatorPnpmStoreDirectory/);
  assert.match(
    releaseSource,
    /pathIsWithin\(operatorHomeDirectory, operatorPnpmStoreDirectory\)[\s\S]*pathIsWithin\(repositoryDirectory, operatorPnpmStoreDirectory\)/,
  );
  assert.match(releaseSource, /RIDDLE_QUEST_LICENSE_STORE_DIR:\s*isolatedPnpmLicenseStoreDirectory/);
  assert.match(releaseSource, /delete gateEnvironment\.RIDDLE_QUEST_LICENSE_STORE_DIR/);
  const licenseGeneratorSource = await readFile(
    new URL("./generate-third-party-licenses.mjs", import.meta.url),
    "utf8",
  );
  assert.match(licenseGeneratorSource, /node_modules\/\.modules\.yaml/);
  assert.match(licenseGeneratorSource, /process\.env\.RIDDLE_QUEST_LICENSE_STORE_DIR/);
  assert.match(licenseGeneratorSource, /pnpm_config_store_dir:\s*pnpmStoreDirectory/);
  assert.doesNotMatch(
    releaseSource,
    /additionalMaskedFilePaths:\s*\[\.\.\.legacyViteEnvironmentPaths/,
  );
  assert.match(releaseSource, /presentLegacyEnvironmentPaths\.length > 0/);
  assert.match(releaseSource, /refusing an unsandboxed fallback/);
  const childEnvironmentAllowlist = releaseSafetySource.slice(
    releaseSafetySource.indexOf("const childEnvironmentKeys = ["),
    releaseSafetySource.indexOf("const requireAbsolutePath"),
  );
  assert.doesNotMatch(childEnvironmentAllowlist, /["']JEST_GAME_UPLOAD_TOKEN["']/);
  assert.doesNotMatch(childEnvironmentAllowlist, /["']LD_LIBRARY_PATH["']/);
  assert.doesNotMatch(childEnvironmentAllowlist, /["']NODE_EXTRA_CA_CERTS["']/);
  assert.doesNotMatch(childEnvironmentAllowlist, /["']SENTRY_AUTH_TOKEN["']/);
  assert.doesNotMatch(childEnvironmentAllowlist, /["']SSL_CERT_(?:DIR|FILE)["']/);
  assert.match(releaseSource, /resolveReleaseCredentialPath\(\{[\s\S]*xdgConfigHome: process\.env\.XDG_CONFIG_HOME/);

  const artifactEnvironment = releaseSource.slice(
    releaseSource.indexOf("const artifactEnvironment ="),
    releaseSource.indexOf("const uploadEnvironment ="),
  );
  for (const [name, pathBinding] of [
    ["JEST_ARCHIVE_PATH", "archivePath"],
    ["JEST_BUILD_DIRECTORY", "releaseBuildDirectory"],
    ["JEST_GATE_RECEIPT_PATH", "gateReceiptPath"],
    ["JEST_RECEIPT_DIRECTORY", "receiptDirectory"],
    ["JEST_SOURCE_REPOSITORY_DIRECTORY", "repositoryDirectory"],
  ]) {
    assert.match(artifactEnvironment, new RegExp(`${name}:\\s*${pathBinding}`));
    assert.match(uploadSource, new RegExp(`name:\\s*["']${name}["']`));
  }
  assert.match(releaseSource, /PORTAL_JEST_BUILD_DIR:\s*verifiedBuildDirectory/);
  assert.match(releaseSource, /PORTAL_USE_EXISTING_BUILD:\s*"1"/);
  assert.match(releaseSource, /JEST_BUILD_OUT_DIR:\s*releaseBuildDirectory/);
  const uploadEnvironment = releaseSource.slice(
    releaseSource.indexOf("const uploadEnvironment ="),
    releaseSource.indexOf("runNode(", releaseSource.indexOf("const uploadEnvironment =")),
  );
  assert.match(uploadEnvironment, /JEST_UPLOAD_TOKEN_STDIN:\s*["']1["']/);
  assert.doesNotMatch(uploadEnvironment, /JEST_GAME_UPLOAD_TOKEN\s*:/);
  assert.match(releaseSource, /JSON\.stringify\(\{uploadToken\}\)/);
  assert.match(uploadSource, /name:\s*["']JEST_PACKAGE_DIRECTORY["']/);
  assert.match(uploadSource, /name:\s*["']JEST_ARTIFACT_AUDIT_SCRIPT["']/);
  assert.match(uploadSource, /name:\s*["']JEST_W3C_VALIDATOR_SCRIPT["']/);
  assert.match(uploadSource, /The trusted release parent did not authorize these exact Jest archive bytes/);
  assert.match(viteSource, /environment\.JEST_BUILD_OUT_DIR/);
  assert.match(viteSource, /jest:\s*jestBuildOutDir/);
  assert.match(viteSource, /filesToDeleteAfterUpload:\s*`\$\{selectedBuildOutDir\}\/\*\*\/\*\.map`/);
  assert.match(releaseSource, /Refusing to release from a dirty worktree/);

  assert.match(uploadSource, /inspectArchiveEntries\(gatedArchive\)/);
  assert.match(uploadSource, /new Blob\(\[gatedArchive\]/);
  assert.doesNotMatch(uploadSource, /inspectArchiveEntries\(archivePath\)/);
  assert.match(artifactSource, /contents\.byteLength !== record\.archive\.bytes/);
  assert.doesNotMatch(artifactSource, /stat\(archivePath\)/);
  assert.match(uploadSource, /await fetch\(/);
  const sourceBarrierPathIndex = uploadSource.indexOf("const unresolvedReceiptPath =");
  const sourceBarrierCreateIndex = uploadSource.indexOf(
    "receiptPath: unresolvedReceiptPath",
    sourceBarrierPathIndex,
  );
  const transmissionIndex = uploadSource.indexOf("await fetch(", sourceBarrierCreateIndex);
  const acceptedReceiptIndex = uploadSource.indexOf(
    "const acceptedAttemptReceipt =",
    transmissionIndex,
  );
  const acceptedSourceBarrierIndex = uploadSource.indexOf(
    "receiptPath: unresolvedReceiptPath",
    acceptedReceiptIndex,
  );
  assert.ok(sourceBarrierPathIndex >= 0 && sourceBarrierCreateIndex > sourceBarrierPathIndex);
  assert.ok(transmissionIndex > sourceBarrierCreateIndex);
  assert.ok(acceptedReceiptIndex > transmissionIndex);
  assert.ok(acceptedSourceBarrierIndex > acceptedReceiptIndex);
  assert.equal(uploadSource.indexOf("removeOwnedUploadAttemptBarrier", transmissionIndex), -1);
  assert.doesNotMatch(uploadSource, /\.env\.jest-upload\.local|process\.loadEnvFile/);
  assert.doesNotMatch(uploadSource, /spawnSync\(\s*["']curl|["']--header["']/);
});
