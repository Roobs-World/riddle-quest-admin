import {createHash, randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import {homedir} from "node:os";
import {basename, dirname, isAbsolute, join, relative, sep} from "node:path";
import {parseEnv} from "node:util";
import {fileURLToPath} from "node:url";

import {
  assertAllowedReleaseCredentialFileKeys,
  BUBBLEWRAP_PATH,
  createReleaseChildEnvironment,
  createReleaseSandboxArguments,
  findUnresolvedUploadBarriers,
  fingerprintReleaseDependencies,
  RIDDLE_QUEST_JEST_GAME_ID,
  resolveReleaseCredentialPath,
  resolveRiddleQuestJestGameId,
} from "./jest-release-safety.mjs";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const gitExecutable = "/usr/bin/git";
const receiptDirectory = join(packageDirectory, ".jest-upload-receipts");
mkdirSync(receiptDirectory, {mode: 0o700, recursive: true});
chmodSync(receiptDirectory, 0o700);
const ignoredSensitiveDirectoryPaths = [
  join(repositoryDirectory, ".firebase"),
  join(repositoryDirectory, "firebase-functions", "artifacts", "notification-copy-backups"),
  receiptDirectory,
].filter((path) => existsSync(path));
const releaseDebugLogDestinationPaths = [
  join(repositoryDirectory, "firebase-debug.log"),
  join(repositoryDirectory, "firestore-debug.log"),
  join(repositoryDirectory, "firebase-functions", "firebase-debug.log"),
  join(repositoryDirectory, "firebase-functions", "firestore-debug.log"),
];
const releaseDebugLogDestinationSet = new Set(releaseDebugLogDestinationPaths);
const ignoredSensitiveFilePaths = [repositoryDirectory, join(repositoryDirectory, "firebase-functions")]
  .flatMap((directory) => readdirSync(directory)
    .filter((name) => /^(?:firebase|firestore)-debug(?:\.\d+)?\.log$/u.test(name))
    .map((name) => join(directory, name)))
  .filter((path) => !releaseDebugLogDestinationSet.has(path));
const legacyViteEnvironmentPaths = [...new Set([
  ".env",
  ".env.local",
  ".env.jest",
  ".env.jest.local",
  ".env.jest-upload.local",
  ...readdirSync(packageDirectory)
    .filter((name) => name === ".env" || name.startsWith(".env.")),
].map((name) => join(packageDirectory, name)))];
const operatorHomeDirectory = homedir();
if (process.platform !== "linux") {
  throw new Error("Secure Jest releases require Linux and functional bubblewrap; refusing an unsandboxed fallback");
}
const releaseSandboxDirectory = mkdtempSync("/tmp/riddle-quest-release-sandbox-");
const releaseDebugLogQuarantineDirectory = join(
  repositoryDirectory,
  ".firebase",
  `jest-release-debug-log-quarantine-${process.pid}-${randomUUID()}`,
);
const quarantinedReleaseDebugLogs = [];
const workspaceRoot = join(releaseSandboxDirectory, "workspaces");
const isolatedHomeDirectory = join(releaseSandboxDirectory, "home");
const isolatedTemporaryDirectory = join(releaseSandboxDirectory, "tmp");
const isolatedRuntimeDirectory = join(releaseSandboxDirectory, "runtime");
for (const directory of [
  isolatedHomeDirectory,
  isolatedTemporaryDirectory,
  isolatedRuntimeDirectory,
]) {
  mkdirSync(directory, {mode: 0o700});
}
chmodSync(releaseSandboxDirectory, 0o700);

const clearFreshReleaseDebugLogs = () => {
  for (const destination of releaseDebugLogDestinationPaths) {
    if (existsSync(destination)) rmSync(destination, {force: true});
  }
};

const restoreQuarantinedReleaseDebugLogs = () => {
  clearFreshReleaseDebugLogs();
  for (const {destination, quarantinePath} of quarantinedReleaseDebugLogs) {
    if (existsSync(quarantinePath)) renameSync(quarantinePath, destination);
  }
  if (existsSync(releaseDebugLogQuarantineDirectory)) {
    rmSync(releaseDebugLogQuarantineDirectory, {force: true, recursive: true});
  }
};

let releaseSandboxOwned = true;
const cleanupReleaseSandbox = () => {
  if (!releaseSandboxOwned) return;
  releaseSandboxOwned = false;
  restoreQuarantinedReleaseDebugLogs();
  // Immutable release inputs are deliberately chmod 0555. Restore owner
  // write permission on sandbox directories only so recursive cleanup can
  // unlink their contents without weakening files while the release runs.
  const makeSandboxDirectoriesWritable = (directory) => {
    if (!existsSync(directory)) return;
    chmodSync(directory, 0o700);
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      if (entry.isDirectory()) makeSandboxDirectoriesWritable(join(directory, entry.name));
    }
  };
  makeSandboxDirectoriesWritable(releaseSandboxDirectory);
  rmSync(releaseSandboxDirectory, {force: true, recursive: true});
};
process.on("exit", cleanupReleaseSandbox);

// Keep any prior Firebase logs unavailable to network-enabled release children
// without bind-mounting the filenames themselves. firebase-tools removes its
// successful-run log during process exit, and Linux rejects unlinking a file
// mount with EBUSY. Atomic same-filesystem renames let the CLI use disposable
// regular files while the ignored .firebase directory remains masked.
mkdirSync(releaseDebugLogQuarantineDirectory, {mode: 0o700, recursive: true});
for (const [index, destination] of releaseDebugLogDestinationPaths.entries()) {
  if (!existsSync(destination)) continue;
  const destinationFile = lstatSync(destination);
  if (!destinationFile.isFile() || destinationFile.isSymbolicLink()) {
    throw new Error(`Firebase release debug log must be a regular file: ${destination}`);
  }
  if (typeof process.getuid === "function" && destinationFile.uid !== process.getuid()) {
    throw new Error(`Firebase release debug log must be owned by the current user: ${destination}`);
  }
  chmodSync(destination, 0o600);
  const quarantinePath = join(releaseDebugLogQuarantineDirectory, `${index}.log`);
  renameSync(destination, quarantinePath);
  quarantinedReleaseDebugLogs.push({destination, quarantinePath});
}

const releaseChildEnvironment = createReleaseChildEnvironment(process.env, {
  isolatedHomeDirectory,
  isolatedRuntimeDirectory,
  isolatedTemporaryDirectory,
});
const credentialPath = resolveReleaseCredentialPath({
  explicitPath: process.env.JEST_RELEASE_CREDENTIALS_FILE,
  homeDirectory: operatorHomeDirectory,
  xdgConfigHome: process.env.XDG_CONFIG_HOME,
});
// Ambient identity overrides are safe to validate before any child. The
// external file stays unread until after the production gate.
resolveRiddleQuestJestGameId(process.env.JEST_GAME_ID);

let releaseSandboxConfiguration;
const run = (
  command,
  args,
  {captureOutput = false, cwd = repositoryDirectory, env, input, sandboxOverrides = {}} = {},
) => {
  if (!releaseSandboxConfiguration) {
    throw new Error("The secure Jest release sandbox must pass its functional probe before running children");
  }
  const sandboxArguments = createReleaseSandboxArguments({
    ...releaseSandboxConfiguration,
    ...sandboxOverrides,
    args,
    command,
    workingDirectory: cwd,
  });
  const result = spawnSync(BUBBLEWRAP_PATH, sandboxArguments, {
    cwd: repositoryDirectory,
    encoding: captureOutput ? "utf8" : undefined,
    env,
    input,
    stdio: captureOutput
      ? ["ignore", "pipe", "pipe"]
      : input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
  return result;
};

const readGit = (args) => {
  const result = run(gitExecutable, [
    "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null",
    ...args,
  ], {
    captureOutput: true,
    env: releaseChildEnvironment,
  });
  return result.stdout.trim();
};

const gitMetadataPointerPath = join(repositoryDirectory, ".git");
if (!existsSync(gitMetadataPointerPath)) throw new Error("The release repository is missing .git metadata");
const gitMetadataPointer = lstatSync(gitMetadataPointerPath);
let absoluteGitDirectory;
if (gitMetadataPointer.isDirectory()) {
  absoluteGitDirectory = realpathSync(gitMetadataPointerPath);
} else if (gitMetadataPointer.isFile()) {
  const match = /^gitdir:\s*(.+?)\s*$/u.exec(readFileSync(gitMetadataPointerPath, "utf8"));
  if (!match) throw new Error("The release repository has an invalid .git pointer");
  absoluteGitDirectory = realpathSync(join(dirname(gitMetadataPointerPath), match[1]));
} else {
  throw new Error("The release repository .git metadata must be a directory or Git pointer file");
}
if (!lstatSync(absoluteGitDirectory).isDirectory()) {
  throw new Error("The release repository Git metadata target must be a directory");
}
const gitMetadataPaths = [gitMetadataPointerPath, absoluteGitDirectory];
const commonDirectoryPath = join(absoluteGitDirectory, "commondir");
if (existsSync(commonDirectoryPath)) {
  const commonDirectoryReference = readFileSync(commonDirectoryPath, "utf8").trim();
  if (!commonDirectoryReference) throw new Error("The release repository has an invalid Git common directory");
  const commonDirectory = realpathSync(join(absoluteGitDirectory, commonDirectoryReference));
  if (!lstatSync(commonDirectory).isDirectory()) {
    throw new Error("The release repository Git common metadata target must be a directory");
  }
  gitMetadataPaths.push(commonDirectory);
}
const uniqueGitMetadataPaths = [...new Set(gitMetadataPaths)];

let sourceCommit;
const assertSourceClean = () => {
  if (readGit(["rev-parse", "HEAD"]) !== sourceCommit) {
    throw new Error("Git HEAD changed during the Jest release; start a new release from the intended commit");
  }
  if (readGit(["status", "--porcelain=v1", "--untracked-files=all"])) {
    throw new Error("Refusing to release from a dirty worktree; commit the production source first");
  }
};

const presentLegacyEnvironmentPaths = legacyViteEnvironmentPaths.filter((path) => existsSync(path));
if (presentLegacyEnvironmentPaths.length > 0) {
  throw new Error(
    "Move every packages/portal/.env* file to the dedicated public Vite env directory or the external " +
      `owner-only release credential file before release: ${presentLegacyEnvironmentPaths.join(", ")}`,
  );
}

const canonicalCredentialPath = existsSync(credentialPath) ? realpathSync(credentialPath) : credentialPath;
const repositoryRelativeCredentialPath = relative(repositoryDirectory, canonicalCredentialPath);
if (
  repositoryRelativeCredentialPath === "" ||
  (!repositoryRelativeCredentialPath.startsWith(`..${sep}`) && !isAbsolute(repositoryRelativeCredentialPath))
) {
  throw new Error("JEST_RELEASE_CREDENTIALS_FILE must resolve outside the repository");
}

const validateCredentialFile = () => {
  if (!existsSync(credentialPath)) return false;
  const file = lstatSync(credentialPath);
  if (!file.isFile()) throw new Error("Jest release credentials must be a regular file, not a link or directory");
  if (typeof process.getuid === "function" && file.uid !== process.getuid()) {
    throw new Error("Jest release credentials must be owned by the current user");
  }
  if ((file.mode & 0o077) !== 0) {
    throw new Error(`Jest release credentials must be owner-only (chmod 600 ${credentialPath})`);
  }
  return true;
};
const hasCredentialFile = validateCredentialFile();
if (!process.env.JEST_GAME_UPLOAD_TOKEN && !hasCredentialFile) {
  throw new Error(
    `JEST_GAME_UPLOAD_TOKEN is required in the process environment or owner-only ${credentialPath}`,
  );
}

const pathIsWithin = (parent, candidate) => {
  const nestedPath = relative(parent, candidate);
  return nestedPath === "" || (!nestedPath.startsWith(`..${sep}`) && !isAbsolute(nestedPath));
};
const releaseSandboxReadOnlyBinds = [];
const addReadOnlyDirectoryBind = (source, destination) => {
  if (!existsSync(source)) return;
  const canonicalSource = realpathSync(source);
  if (!lstatSync(canonicalSource).isDirectory()) {
    throw new Error(`Jest release runtime/cache path must be a directory: ${source}`);
  }
  releaseSandboxReadOnlyBinds.push({source: canonicalSource, destination});
};

const releaseNodeExecutable = realpathSync(process.execPath);
const nodeRuntimeDirectory = dirname(dirname(releaseNodeExecutable));
if (pathIsWithin(operatorHomeDirectory, nodeRuntimeDirectory)) {
  addReadOnlyDirectoryBind(nodeRuntimeDirectory, nodeRuntimeDirectory);
}
if (process.env.JAVA_HOME) {
  if (!isAbsolute(process.env.JAVA_HOME)) throw new Error("JAVA_HOME must be absolute for a secure Jest release");
  if (pathIsWithin(operatorHomeDirectory, process.env.JAVA_HOME)) {
    addReadOnlyDirectoryBind(process.env.JAVA_HOME, process.env.JAVA_HOME);
  }
}

// `pnpm licenses list` reads package metadata from the content-addressed store
// recorded by the installed workspace. Expose that exact store read-only only
// during the credential-free production gate; an isolated empty HOME otherwise
// makes the license consistency check fail despite a frozen installation.
const pnpmModulesMetadata = JSON.parse(
  readFileSync(join(repositoryDirectory, "node_modules", ".modules.yaml"), "utf8"),
);
const operatorPnpmStoreDirectory = pnpmModulesMetadata.storeDir;
if (typeof operatorPnpmStoreDirectory !== "string" || !isAbsolute(operatorPnpmStoreDirectory)) {
  throw new Error("The installed pnpm package store must be an absolute path for a secure release");
}
if (
  !pathIsWithin(operatorHomeDirectory, operatorPnpmStoreDirectory) ||
  pathIsWithin(repositoryDirectory, operatorPnpmStoreDirectory)
) {
  throw new Error("The installed pnpm package store must be outside the repository and inside the operator home");
}
const operatorPnpmStoreIndexPath = join(operatorPnpmStoreDirectory, "index.db");
const operatorPnpmStoreFilesDirectory = join(operatorPnpmStoreDirectory, "files");
if (!lstatSync(operatorPnpmStoreIndexPath).isFile()) {
  throw new Error("The installed pnpm package store index must be a regular file");
}
const isolatedPnpmLicenseStoreDirectory = join(
  releaseSandboxDirectory,
  "pnpm-license-store",
  basename(operatorPnpmStoreDirectory),
);
mkdirSync(isolatedPnpmLicenseStoreDirectory, {mode: 0o700, recursive: true});
copyFileSync(operatorPnpmStoreIndexPath, join(isolatedPnpmLicenseStoreDirectory, "index.db"));
chmodSync(join(isolatedPnpmLicenseStoreDirectory, "index.db"), 0o600);
addReadOnlyDirectoryBind(
  operatorPnpmStoreFilesDirectory,
  join(isolatedPnpmLicenseStoreDirectory, "files"),
);

const isolatedCorepackCache = join(isolatedHomeDirectory, ".cache", "node", "corepack");
const operatorCorepackCache = process.env.COREPACK_HOME ||
  join(operatorHomeDirectory, ".cache", "node", "corepack");
if (!isAbsolute(operatorCorepackCache)) {
  throw new Error("COREPACK_HOME must be absolute for a secure Jest release");
}
mkdirSync(isolatedCorepackCache, {mode: 0o700, recursive: true});
addReadOnlyDirectoryBind(operatorCorepackCache, isolatedCorepackCache);

// Firebase's Firestore and Storage rules emulators are large runtime artifacts
// installed outside node_modules. Freeze a private copy inside the isolated
// writable HOME: firebase-tools may update cache metadata during startup, so a
// read-only bind fails even when the required runtimes are already installed.
const operatorFirebaseEmulatorCache = join(operatorHomeDirectory, ".cache", "firebase", "emulators");
const isolatedFirebaseEmulatorCache = join(isolatedHomeDirectory, ".cache", "firebase", "emulators");
if (existsSync(operatorFirebaseEmulatorCache)) {
  cpSync(operatorFirebaseEmulatorCache, isolatedFirebaseEmulatorCache, {recursive: true});
}

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const operatorPlaywrightCache = join(operatorHomeDirectory, ".cache", "ms-playwright");
  const isolatedPlaywrightCache = join(isolatedHomeDirectory, ".cache", "ms-playwright");
  mkdirSync(isolatedPlaywrightCache, {mode: 0o700, recursive: true});
  addReadOnlyDirectoryBind(operatorPlaywrightCache, isolatedPlaywrightCache);
} else if (process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") {
  if (!isAbsolute(process.env.PLAYWRIGHT_BROWSERS_PATH)) {
    throw new Error("PLAYWRIGHT_BROWSERS_PATH must be absolute or 0 for a secure Jest release");
  }
  if (pathIsWithin(operatorHomeDirectory, process.env.PLAYWRIGHT_BROWSERS_PATH)) {
    addReadOnlyDirectoryBind(
      process.env.PLAYWRIGHT_BROWSERS_PATH,
      process.env.PLAYWRIGHT_BROWSERS_PATH,
    );
  }
}

releaseSandboxConfiguration = {
  additionalMaskedDirectoryPaths: ignoredSensitiveDirectoryPaths,
  // Package-root .env files are rejected above, before bubblewrap runs. Do not
  // ask bubblewrap to mask nonexistent destinations inside the writable
  // repository: creating those mount points dirties the host worktree and
  // makes every otherwise-valid release fail its post-probe clean check.
  additionalMaskedFilePaths: ignoredSensitiveFilePaths,
  credentialPath: canonicalCredentialPath,
  gitMetadataPaths: uniqueGitMetadataPaths,
  operatorHomeDirectory,
  readOnlyBinds: releaseSandboxReadOnlyBinds,
  repositoryDirectory,
  sandboxDirectory: releaseSandboxDirectory,
  writableBinds: [],
};

const assertReleaseSandboxAvailable = () => {
  const probe = spawnSync(
    BUBBLEWRAP_PATH,
    createReleaseSandboxArguments({
      ...releaseSandboxConfiguration,
      args: ["--eval", ""],
      command: releaseNodeExecutable,
      workingDirectory: repositoryDirectory,
    }),
    {
      cwd: repositoryDirectory,
      encoding: "utf8",
      env: releaseChildEnvironment,
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  if (probe.error || probe.status !== 0) {
    const detail = probe.error?.message || probe.stderr?.trim() || `exit code ${probe.status ?? "unknown"}`;
    releaseSandboxConfiguration = undefined;
    throw new Error(
      `Secure Jest releases require functional ${BUBBLEWRAP_PATH}; refusing an unsandboxed fallback (${detail})`,
    );
  }
};
assertReleaseSandboxAvailable();

sourceCommit = readGit(["rev-parse", "HEAD"]);
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Git HEAD is not a full commit identifier");
if (readGit(["rev-parse", "--absolute-git-dir"]) !== absoluteGitDirectory) {
  throw new Error("Sandboxed Git metadata does not match the filesystem-resolved release repository");
}
assertSourceClean();

// Ignored deployment/runtime .env files are neither release inputs nor safe
// for network-enabled build dependencies to inspect. Discover them through
// fixed, sandboxed Git and mask every real file before the production gate.
const ignoredEnvironmentPaths = readGit([
  "ls-files",
  "--others",
  "--ignored",
  "--exclude-standard",
  "-z",
  "--",
  ":(glob)**/.env",
  ":(glob)**/.env.*",
]).split("\0").filter(Boolean).filter((relativePath) => {
  const name = relativePath.split("/").at(-1);
  return name !== ".env.example" && (name === ".env" || name?.startsWith(".env."));
}).map((relativePath) => join(repositoryDirectory, relativePath));
for (const environmentPath of ignoredEnvironmentPaths) {
  const file = lstatSync(environmentPath);
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error(`Ignored release environment path must be a regular file: ${environmentPath}`);
  }
  if (typeof process.getuid === "function" && file.uid !== process.getuid()) {
    throw new Error(`Ignored release environment file must be owned by the current user: ${environmentPath}`);
  }
  if ((file.mode & 0o077) !== 0) {
    throw new Error(`Ignored release environment file must be owner-only (chmod 600 ${environmentPath})`);
  }
}
releaseSandboxConfiguration.additionalMaskedFilePaths.push(...ignoredEnvironmentPaths);

const loadReleaseCredentials = () => {
  if (hasCredentialFile &&
      (!validateCredentialFile() || realpathSync(credentialPath) !== canonicalCredentialPath)) {
    throw new Error("Jest release credential path changed during the production gate");
  }
  const fileCredentials = hasCredentialFile ? parseEnv(readFileSync(canonicalCredentialPath, "utf8")) : {};
  assertAllowedReleaseCredentialFileKeys(Object.keys(fileCredentials));
  return {...fileCredentials, ...process.env};
};

const now = new Date();
const stamp = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, "0"),
  String(now.getUTCDate()).padStart(2, "0"),
  String(now.getUTCHours()).padStart(2, "0"),
  String(now.getUTCMinutes()).padStart(2, "0"),
  String(now.getUTCSeconds()).padStart(2, "0"),
].join("");
const attemptId = randomUUID().replaceAll("-", "").slice(0, 8);
const packageVersion = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")).version;
const buildVersion = `${packageVersion}-dev.${stamp}.${sourceCommit.slice(0, 12)}.${attemptId}`;
const sentryRelease = `riddle-quest@${buildVersion}`;
const workspaceDirectory = join(workspaceRoot, buildVersion);
const immutableSourceDirectory = join(workspaceDirectory, "source");
const immutablePackageDirectory = join(immutableSourceDirectory, "packages", "portal");
const releaseBuildDirectory = join(workspaceDirectory, "build");
const verifiedBuildDirectory = join(workspaceDirectory, "verified");
const archivePath = join(workspaceDirectory, `${buildVersion}.zip`);
const gateReceiptPath = join(receiptDirectory, `${buildVersion}.gated.json`);
const lockPath = join(receiptDirectory, "release.lock");

mkdirSync(receiptDirectory, {mode: 0o700, recursive: true});
chmodSync(receiptDirectory, 0o700);
let lockOwned = false;
let lockDescriptor;
try {
  lockDescriptor = openSync(lockPath, "wx", 0o600);
  lockOwned = true;
  writeFileSync(
    lockDescriptor,
    `${JSON.stringify({pid: process.pid, buildVersion, sourceCommit, startedAt: now.toISOString()})}\n`,
  );
  closeSync(lockDescriptor);
  lockDescriptor = undefined;
} catch (error) {
  if (lockDescriptor !== undefined) closeSync(lockDescriptor);
  if (lockOwned) {
    lockOwned = false;
    rmSync(lockPath, {force: true});
  }
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    throw new Error(`Another Jest release owns ${lockPath}; reconcile that release before removing a stale lock`);
  }
  throw error;
}

const releaseLock = () => {
  if (!lockOwned) return;
  lockOwned = false;
  rmSync(lockPath, {force: true});
};
process.on("exit", releaseLock);
for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => {
    releaseLock();
    process.exit(exitCode);
  });
}

const gateEnvironment = {
  ...releaseChildEnvironment,
  JEST_BUILD_COMMIT: sourceCommit,
  JEST_BUILD_VERSION: buildVersion,
  JEST_GAME_ID: RIDDLE_QUEST_JEST_GAME_ID,
  JEST_RELEASE_ATTEMPT_ID: attemptId,
  JEST_UPLOAD_IS_ACTIVE: "false",
  JEST_UPLOAD_DRY_RUN: "false",
  SENTRY_RELEASE: sentryRelease,
  SENTRY_UPLOAD_SOURCEMAPS: "0",
  VITE_SENTRY_RELEASE: sentryRelease,
  RIDDLE_QUEST_LICENSE_STORE_DIR: isolatedPnpmLicenseStoreDirectory,
};
const gatePreflightDirectory = join(releaseSandboxDirectory, "gate-preflight");
mkdirSync(gatePreflightDirectory, {mode: 0o700});
Object.assign(gateEnvironment, {
  JEST_ARCHIVE_PATH: join(gatePreflightDirectory, "build.zip"),
  JEST_BUILD_DIRECTORY: join(packageDirectory, "dist-jest"),
  JEST_GATE_RECEIPT_PATH: join(gatePreflightDirectory, "gated-artifact.json"),
  JEST_RECEIPT_DIRECTORY: gatePreflightDirectory,
});
delete gateEnvironment.JEST_CONFIRM_ACTIVATION;

const runPnpm = (args, environment, cwd = repositoryDirectory) => run("pnpm", args, {cwd, env: environment});
const runNode = (script, args, environment, cwd, input, sandboxOverrides) =>
  run(releaseNodeExecutable, [script, ...args], {
    cwd,
    env: environment,
    input,
    sandboxOverrides,
  });

const materializeCommittedSource = () => {
  mkdirSync(workspaceDirectory, {mode: 0o700, recursive: true});
  mkdirSync(immutableSourceDirectory, {mode: 0o700});
  const archive = join(workspaceDirectory, "source.tar");
  run(gitExecutable, ["archive", "--format=tar", `--output=${archive}`, sourceCommit], {
    cwd: repositoryDirectory,
    env: gateEnvironment,
  });
  run("/usr/bin/tar", ["-xf", archive, "-C", immutableSourceDirectory], {env: gateEnvironment});
  rmSync(archive, {force: true});

  for (const relativeDirectory of ["", join("packages", "core"), join("packages", "portal")]) {
    const installedModules = join(repositoryDirectory, relativeDirectory, "node_modules");
    const immutableModules = join(immutableSourceDirectory, relativeDirectory, "node_modules");
    if (existsSync(installedModules)) symlinkSync(installedModules, immutableModules, "dir");
  }
};

const trustedScriptsDirectory = join(releaseSandboxDirectory, "trusted-scripts");
const trustedScriptNames = [
  "audit-jest-artifact.mjs",
  "jest-release-safety.mjs",
  "jest-upload-artifact.mjs",
  "upload-jest-build.mjs",
  "validate-w3c.mjs",
];
const snapshotTrustedReleaseScripts = () => {
  mkdirSync(trustedScriptsDirectory, {mode: 0o700});
  for (const scriptName of trustedScriptNames) {
    const sourcePath = join(immutablePackageDirectory, "scripts", scriptName);
    if (!lstatSync(sourcePath).isFile()) {
      throw new Error(`Trusted release script must be a committed regular file: ${scriptName}`);
    }
    const targetPath = join(trustedScriptsDirectory, scriptName);
    copyFileSync(sourcePath, targetPath);
    chmodSync(targetPath, 0o444);
  }
  chmodSync(trustedScriptsDirectory, 0o555);
  releaseSandboxConfiguration.repositoryReadOnly = true;
  releaseSandboxConfiguration.protectedReadOnlyBinds = [
    {source: immutableSourceDirectory, destination: immutableSourceDirectory},
    {source: trustedScriptsDirectory, destination: trustedScriptsDirectory},
  ];
};
const trustedScript = (name) => join(trustedScriptsDirectory, name);
const fingerprintFile = (filePath) => {
  const contents = readFileSync(filePath);
  return {
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
};
const assertFileFingerprint = (filePath, expected, label) => {
  const actual = fingerprintFile(filePath);
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error(`${label} changed after exact-artifact verification; start a new release`);
  }
};

const resolveViteCli = () => {
  const vitePackageJson = JSON.parse(readFileSync(join(packageDirectory, "node_modules", "vite", "package.json"), "utf8"));
  const vitePackageDirectory = dirname(join(packageDirectory, "node_modules", "vite", "package.json"));
  return join(vitePackageDirectory, vitePackageJson.bin.vite);
};

const resolveTypeScriptCli = () => {
  const typescriptPackageJson = JSON.parse(
    readFileSync(join(packageDirectory, "node_modules", "typescript", "package.json"), "utf8"),
  );
  const executable = typescriptPackageJson.bin?.tsc6 ?? typescriptPackageJson.bin?.tsc;
  if (typeof executable !== "string") {
    throw new Error("The installed TypeScript package does not expose a tsc executable");
  }
  return join(packageDirectory, "node_modules", "typescript", executable);
};

const resolveJestCli = () => {
  const jestPackageJson = JSON.parse(
    readFileSync(join(packageDirectory, "node_modules", "jest", "package.json"), "utf8"),
  );
  if (typeof jestPackageJson.bin !== "string") {
    throw new Error("The installed Jest package does not expose a CLI executable");
  }
  return join(packageDirectory, "node_modules", "jest", jestPackageJson.bin);
};

const makeReadOnly = (directory) => {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      makeReadOnly(entryPath);
      chmodSync(entryPath, 0o555);
    } else {
      chmodSync(entryPath, 0o444);
    }
  }
  chmodSync(directory, 0o555);
};

for (const key of ["JEST_UPLOAD_IS_ACTIVE", "JEST_CONFIRM_ACTIVATION"]) {
  if (process.env[key] !== undefined) {
    throw new Error(`${key} is unsupported; timestamped Jest releases are inactive-only`);
  }
}
console.log(`Gating immutable Jest build ${buildVersion} from ${sourceCommit}`);

try {
  const unresolvedUploadBarriers = findUnresolvedUploadBarriers({
    receiptDirectory,
    sourceCommit,
  });
  if (unresolvedUploadBarriers.length > 0) {
    throw new Error(
      `A prior upload of source ${sourceCommit} has an unresolved cross-version barrier. ` +
      "Reconcile it in the Jest Developer Console or build-completion email before manually removing: " +
      unresolvedUploadBarriers.join(", "),
    );
  }
  const dependencyFingerprint = fingerprintReleaseDependencies({repositoryDirectory});

  // Known Console metadata and assets are part of ordinary builds. A real
  // timestamped release additionally requires the two owner-approved identity
  // decisions before this process reads credentials or can transmit bytes.
  runPnpm(["--filter", "@qwordly/portal", "check:jest-console:release"], gateEnvironment);

  // The long gate receives metadata only: no upload token, email, credential
  // path, Sentry token, or unrelated ambient environment. Release credentials
  // are read only after it passes.
  runPnpm(["verify:production:extended"], gateEnvironment);
  assertSourceClean();
  // The remaining credential-bearing phase never invokes Firebase emulators.
  // Remove disposable gate logs before credentials are loaded; prior logs stay
  // quarantined until every sandboxed release child has exited.
  clearFreshReleaseDebugLogs();
  delete gateEnvironment.RIDDLE_QUEST_LICENSE_STORE_DIR;
  releaseSandboxConfiguration.readOnlyBinds = releaseSandboxConfiguration.readOnlyBinds
    .filter(({destination}) => destination !== join(isolatedPnpmLicenseStoreDirectory, "files"));

  // Snapshot the exact committed source and token-bearing release leaf before
  // private credential contents enter this process.
  materializeCommittedSource();
  snapshotTrustedReleaseScripts();

  const credentials = loadReleaseCredentials();
  const uploadToken = credentials.JEST_GAME_UPLOAD_TOKEN;
  const notificationEmail = credentials.JEST_NOTIFICATION_EMAIL;
  if (!uploadToken) throw new Error("JEST_GAME_UPLOAD_TOKEN is required after the production gate");
  if (!notificationEmail) throw new Error("JEST_NOTIFICATION_EMAIL is required after the production gate");

  const gameId = resolveRiddleQuestJestGameId(credentials.JEST_GAME_ID);
  for (const [name, value] of Object.entries({gameId, notificationEmail, uploadToken})) {
    if (/\r|\n/.test(value)) throw new Error(`${name} must not contain newlines`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
    throw new Error("JEST_NOTIFICATION_EMAIL must be a valid email address");
  }
  const activationRequested = false;
  console.log(`Creating an inactive draft in ${workspaceDirectory}`);

  const immutableEnvironment = {
    ...gateEnvironment,
    JEST_GAME_ID: gameId,
    JEST_UPLOAD_IS_ACTIVE: "false",
  };
  const sentryBuildEnvironment = {
    ...immutableEnvironment,
    JEST_BUILD: "1",
    JEST_BUILD_OUT_DIR: releaseBuildDirectory,
    NODE_ENV: "production",
    SENTRY_UPLOAD_SOURCEMAPS: credentials.SENTRY_UPLOAD_SOURCEMAPS || "0",
    VITE_JEST_RUNTIME: "1",
    ...(credentials.SENTRY_AUTH_TOKEN ? {SENTRY_AUTH_TOKEN: credentials.SENTRY_AUTH_TOKEN} : {}),
    ...(credentials.SENTRY_ORG ? {SENTRY_ORG: credentials.SENTRY_ORG} : {}),
    ...(credentials.SENTRY_PROJECT ? {SENTRY_PROJECT: credentials.SENTRY_PROJECT} : {}),
  };
  const artifactEnvironment = {
    ...immutableEnvironment,
    JEST_ARCHIVE_PATH: archivePath,
    JEST_ARTIFACT_AUDIT_SCRIPT: trustedScript("audit-jest-artifact.mjs"),
    JEST_BUILD_DIRECTORY: releaseBuildDirectory,
    JEST_CONSOLE_MANIFEST_PATH: join(immutableSourceDirectory, "docs", "jest-developer-console.json"),
    JEST_GATE_RECEIPT_PATH: gateReceiptPath,
    JEST_PACKAGE_DIRECTORY: immutablePackageDirectory,
    JEST_RECEIPT_DIRECTORY: receiptDirectory,
    JEST_SOURCE_REPOSITORY_DIRECTORY: repositoryDirectory,
    JEST_W3C_VALIDATOR_SCRIPT: trustedScript("validate-w3c.mjs"),
  };
  const uploadEnvironment = {
    ...artifactEnvironment,
    JEST_NOTIFICATION_EMAIL: notificationEmail,
    JEST_UPLOAD_TOKEN_STDIN: "1",
    JEST_UPLOAD_DRY_RUN: "false",
  };

  runNode(join(immutablePackageDirectory, "scripts", "audit-locales.mjs"), [], immutableEnvironment, immutablePackageDirectory);
  // Invoke the resolved committed tool directly. `pnpm exec` performs a
  // dependency-state check that writes beside node_modules and is incompatible
  // with the intentionally read-only immutable release tree.
  runNode(
    resolveTypeScriptCli(),
    ["-p", "tsconfig.json", "--noEmit"],
    immutableEnvironment,
    immutablePackageDirectory,
  );
  runNode(
    resolveViteCli(),
    [
      "build",
      "--mode", "jest",
      "--outDir", releaseBuildDirectory,
      // The default config bundler writes node_modules/.vite-temp. The runner
      // keeps the committed dependency tree read-only after the release gate.
      "--configLoader", "runner",
    ],
    sentryBuildEnvironment,
    immutablePackageDirectory,
  );
  runNode(
    trustedScript("audit-jest-artifact.mjs"),
    [releaseBuildDirectory],
    artifactEnvironment,
    immutablePackageDirectory,
  );

  // Package first, then extract and test the archive's actual bytes. The
  // extracted tree is made read-only before either validator or browser runs.
  runNode(
    trustedScript("upload-jest-build.mjs"),
    [],
    {...artifactEnvironment, JEST_UPLOAD_DRY_RUN: "true"},
    immutablePackageDirectory,
    undefined,
    {writableBinds: [{source: receiptDirectory, destination: receiptDirectory}]},
  );
  const verifiedArchiveFingerprint = fingerprintFile(archivePath);
  const verifiedGateReceiptFingerprint = fingerprintFile(gateReceiptPath);
  releaseSandboxConfiguration.protectedReadOnlyBinds.push(
    {source: archivePath, destination: archivePath},
    {source: gateReceiptPath, destination: gateReceiptPath},
  );
  uploadEnvironment.JEST_EXPECTED_ARCHIVE_BYTES = String(verifiedArchiveFingerprint.bytes);
  uploadEnvironment.JEST_EXPECTED_ARCHIVE_SHA256 = verifiedArchiveFingerprint.sha256;
  mkdirSync(verifiedBuildDirectory, {mode: 0o700});
  run("/usr/bin/unzip", ["-q", archivePath, "-d", verifiedBuildDirectory], {env: immutableEnvironment});
  makeReadOnly(verifiedBuildDirectory);
  releaseSandboxConfiguration.protectedReadOnlyBinds.push(
    {source: verifiedBuildDirectory, destination: verifiedBuildDirectory},
  );
  runNode(
    trustedScript("audit-jest-artifact.mjs"),
    [verifiedBuildDirectory],
    artifactEnvironment,
    immutablePackageDirectory,
  );
  runNode(
    trustedScript("validate-w3c.mjs"),
    [join(verifiedBuildDirectory, "index.html")],
    immutableEnvironment,
    immutablePackageDirectory,
  );
  const verifiedBrowserEnvironment = {
    ...immutableEnvironment,
    PORTAL_BROWSER_TESTS: "1",
    PORTAL_JEST_BUILD_DIR: verifiedBuildDirectory,
    PORTAL_USE_EXISTING_BUILD: "1",
  };
  for (const testPath of [
    "src/play/__tests__/hostedBrowser.jest-playwright.test.ts",
    "src/jest/__tests__/authentication.jest-playwright.test.ts",
  ]) {
    runNode(
      resolveJestCli(),
      ["--config", "jest.config.cjs", "--runInBand", testPath],
      verifiedBrowserEnvironment,
      immutablePackageDirectory,
    );
  }
  assertSourceClean();
  const finalDependencyFingerprint = fingerprintReleaseDependencies({repositoryDirectory});
  if (finalDependencyFingerprint !== dependencyFingerprint) {
    throw new Error(
      "Release dependency inputs changed after the production gate began; " +
      "restore the lockfile and node_modules, then start a new release",
    );
  }
  assertFileFingerprint(archivePath, verifiedArchiveFingerprint, "The gated Jest archive");
  assertFileFingerprint(gateReceiptPath, verifiedGateReceiptFingerprint, "The gated Jest receipt");

  // Upload uses the unchanged in-memory-verified archive. The uploader owns
  // transmission receipts and leaves ambiguous outcomes blocked for review.
  runNode(
    trustedScript("upload-jest-build.mjs"),
    [],
    uploadEnvironment,
    immutablePackageDirectory,
    JSON.stringify({uploadToken}),
    {writableBinds: [{source: receiptDirectory, destination: receiptDirectory}]},
  );

  console.log(
    `Jest accepted build ${buildVersion} for processing as ` +
      `${activationRequested ? "an activation request" : "an inactive draft"}.`,
  );
} finally {
  releaseLock();
  cleanupReleaseSandbox();
}
