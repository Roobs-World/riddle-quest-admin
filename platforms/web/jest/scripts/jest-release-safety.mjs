import {createHash} from "node:crypto";
import {existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, symlinkSync} from "node:fs";
import {dirname, isAbsolute, join, relative, resolve, sep} from "node:path";
import {DatabaseSync, backup} from "node:sqlite";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gitCommitPattern = /^[0-9a-f]{40}$/;
const unresolvedUploadSuffix = ".unresolved-upload.json";

/** Fixed host executable used for the fail-closed Linux release sandbox. */
export const BUBBLEWRAP_PATH = "/usr/bin/bwrap";

/** Snapshots committed pnpm records, including WAL pages, without changing the installed store. */
export async function snapshotPnpmStoreIndex(source, destination) {
  const database = new DatabaseSync(source, {readOnly: true});
  try {await backup(database, destination);}
  finally {database.close();}
}

/** The only Jest game this repository is allowed to upload or activate. */
export const RIDDLE_QUEST_JEST_GAME_ID = "019faa68-f3ec-755d-9ab5-c887fb426801";

/** Resolves an optional credential binding without allowing it to retarget a release. */
export const resolveRiddleQuestJestGameId = (configuredGameId) => {
  if (configuredGameId !== undefined && configuredGameId !== RIDDLE_QUEST_JEST_GAME_ID) {
    throw new Error(`JEST_GAME_ID must equal ${RIDDLE_QUEST_JEST_GAME_ID}`);
  }
  return RIDDLE_QUEST_JEST_GAME_ID;
};

const releaseCredentialFileKeys = new Set([
  "JEST_GAME_ID",
  "JEST_GAME_UPLOAD_TOKEN",
  "JEST_NOTIFICATION_EMAIL",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_UPLOAD_SOURCEMAPS",
]);

export const assertAllowedReleaseCredentialFileKeys = (keys) => {
  const unsupported = keys.filter((key) => !releaseCredentialFileKeys.has(key));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported Jest release credential file keys: ${unsupported.join(", ")}`);
  }
};

const childEnvironmentKeys = [
  "CI",
  "JAVA_HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "TZ",
];

const requireAbsolutePath = (name, value) => {
  if (typeof value !== "string" || !value.trim() || !isAbsolute(value)) {
    throw new Error(`${name} must be a nonempty absolute path`);
  }
  return value;
};

export const createReleaseChildEnvironment = (
  environment,
  {
    isolatedHomeDirectory,
    isolatedRuntimeDirectory,
    isolatedTemporaryDirectory,
  },
) => {
  const childEnvironment = {};
  for (const key of childEnvironmentKeys) {
    if (typeof environment[key] === "string") childEnvironment[key] = environment[key];
  }
  if (!childEnvironment.PATH) throw new Error("PATH is required for Jest release child processes");
  childEnvironment.HOME = requireAbsolutePath("The isolated child HOME", isolatedHomeDirectory);
  childEnvironment.TEMP = requireAbsolutePath(
    "The isolated child temporary directory",
    isolatedTemporaryDirectory,
  );
  childEnvironment.TMP = childEnvironment.TEMP;
  childEnvironment.TMPDIR = childEnvironment.TEMP;
  childEnvironment.XDG_RUNTIME_DIR = requireAbsolutePath(
    "The isolated child runtime directory",
    isolatedRuntimeDirectory,
  );
  // The frozen dependency graph is fingerprinted before and after the gate; release children must never reinstall it.
  childEnvironment.pnpm_config_verify_deps_before_run = "false";
  return childEnvironment;
};

/**
 * Produces a fixed-order bubblewrap mount plan for every untrusted release
 * child. Later mounts intentionally narrow earlier ones: the operator home is
 * hidden before approved runtimes/caches and the repository are restored, Git
 * metadata is made read-only after the writable repository bind, and the
 * credential path is masked last.
 */
export const createReleaseSandboxArguments = ({
  additionalMaskedDirectoryPaths = [],
  additionalMaskedFilePaths = [],
  args = [],
  command,
  credentialPath,
  gitMetadataPaths,
  operatorHomeDirectory,
  protectedReadOnlyBinds = [],
  readOnlyBinds = [],
  repositoryDirectory,
  repositoryReadOnly = false,
  sandboxDirectory,
  writableBinds = [],
  workingDirectory,
}) => {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("The release command must be nonempty");
  }
  requireAbsolutePath("The release credential path", credentialPath);
  requireAbsolutePath("The operator home directory", operatorHomeDirectory);
  requireAbsolutePath("The release repository directory", repositoryDirectory);
  requireAbsolutePath("The release sandbox directory", sandboxDirectory);
  requireAbsolutePath("The release working directory", workingDirectory);
  if (operatorHomeDirectory === "/") {
    throw new Error("The operator home directory cannot be the filesystem root");
  }
  if (repositoryDirectory === operatorHomeDirectory || sandboxDirectory === operatorHomeDirectory) {
    throw new Error("The release sandbox cannot re-expose the complete operator home directory");
  }
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
    throw new Error("Release command arguments must be strings");
  }
  if (!Array.isArray(gitMetadataPaths) || gitMetadataPaths.length === 0) {
    throw new Error("At least one Git metadata path is required for the release sandbox");
  }
  if (!Array.isArray(additionalMaskedFilePaths)) {
    throw new Error("Additional release mask paths must be an array");
  }
  if (!Array.isArray(additionalMaskedDirectoryPaths)) {
    throw new Error("Additional release directory mask paths must be an array");
  }
  if (!Array.isArray(protectedReadOnlyBinds) || !Array.isArray(writableBinds)) {
    throw new Error("Protected and writable release binds must be arrays");
  }

  const sandboxArguments = [
    "--ro-bind", "/", "/",
    "--dev", "/dev",
    "--proc", "/proc",
    "--unshare-all",
    // W3C validation, dependency audits, emulators, and browser tests require
    // network access. Every other namespace remains private.
    "--share-net",
    "--die-with-parent",
    "--new-session",
    "--cap-drop", "ALL",
    "--perms", "0700", "--tmpfs", operatorHomeDirectory,
    "--perms", "1777", "--tmpfs", "/tmp",
    "--dir", dirname(sandboxDirectory),
    "--bind", sandboxDirectory, sandboxDirectory,
  ];

  for (const binding of readOnlyBinds) {
    requireAbsolutePath("A release runtime/cache bind source", binding?.source);
    requireAbsolutePath("A release runtime/cache bind destination", binding?.destination);
    if (binding.source === operatorHomeDirectory || binding.destination === operatorHomeDirectory) {
      throw new Error("The release sandbox cannot re-expose the complete operator home directory");
    }
    sandboxArguments.push(
      "--dir", dirname(binding.destination),
      "--ro-bind", binding.source, binding.destination,
    );
  }

  sandboxArguments.push(
    "--dir", dirname(repositoryDirectory),
    repositoryReadOnly ? "--ro-bind" : "--bind", repositoryDirectory, repositoryDirectory,
  );
  for (const maskedDirectoryPath of additionalMaskedDirectoryPaths) {
    requireAbsolutePath("An additional release directory mask path", maskedDirectoryPath);
    sandboxArguments.push(
      "--dir", dirname(maskedDirectoryPath),
      "--perms", "0700", "--tmpfs", maskedDirectoryPath,
    );
  }
  for (const binding of writableBinds) {
    requireAbsolutePath("A writable release bind source", binding?.source);
    requireAbsolutePath("A writable release bind destination", binding?.destination);
    sandboxArguments.push(
      "--dir", dirname(binding.destination),
      "--bind", binding.source, binding.destination,
    );
  }
  for (const gitMetadataPath of gitMetadataPaths) {
    requireAbsolutePath("A Git metadata path", gitMetadataPath);
    sandboxArguments.push(
      "--dir", dirname(gitMetadataPath),
      "--ro-bind", gitMetadataPath, gitMetadataPath,
    );
  }
  for (const binding of protectedReadOnlyBinds) {
    requireAbsolutePath("A protected release bind source", binding?.source);
    requireAbsolutePath("A protected release bind destination", binding?.destination);
    sandboxArguments.push(
      "--dir", dirname(binding.destination),
      "--ro-bind", binding.source, binding.destination,
    );
  }
  for (const maskedFilePath of additionalMaskedFilePaths) {
    requireAbsolutePath("An additional release mask path", maskedFilePath);
    sandboxArguments.push(
      "--dir", dirname(maskedFilePath),
      "--ro-bind", "/dev/null", maskedFilePath,
    );
  }
  sandboxArguments.push(
    "--dir", dirname(credentialPath),
    "--ro-bind", "/dev/null", credentialPath,
    "--chdir", workingDirectory,
    "--",
    command,
    ...args,
  );
  return sandboxArguments;
};

export const resolveReleaseCredentialPath = ({
  explicitPath,
  homeDirectory,
  xdgConfigHome,
}) => {
  if (!homeDirectory?.trim() || !isAbsolute(homeDirectory)) {
    throw new Error("The user home directory must be a nonempty absolute path");
  }
  let configDirectory = join(homeDirectory, ".config");
  if (xdgConfigHome !== undefined) {
    if (!xdgConfigHome.trim() || !isAbsolute(xdgConfigHome)) {
      throw new Error("XDG_CONFIG_HOME must be a nonempty absolute path when provided");
    }
    configDirectory = xdgConfigHome;
  }
  if (explicitPath !== undefined) {
    if (!explicitPath.trim()) {
      throw new Error("JEST_RELEASE_CREDENTIALS_FILE must be nonempty when provided");
    }
    return resolve(explicitPath);
  }
  return join(configDirectory, "riddle-quest", "jest-release.env");
};

export const getUnresolvedUploadBarrierPath = ({gameId, receiptDirectory, sourceCommit}) => {
  if (!isAbsolute(receiptDirectory)) throw new Error("The Jest receipt directory must be absolute");
  if (!uuidPattern.test(gameId)) throw new Error("Cannot create a source upload barrier for an invalid game ID");
  if (!gitCommitPattern.test(sourceCommit)) {
    throw new Error("Cannot create a source upload barrier for an invalid Git commit");
  }
  return join(receiptDirectory, `${gameId.toLowerCase()}.${sourceCommit}${unresolvedUploadSuffix}`);
};

export const findUnresolvedUploadBarriers = ({receiptDirectory, sourceCommit}) => {
  if (!isAbsolute(receiptDirectory)) throw new Error("The Jest receipt directory must be absolute");
  if (!gitCommitPattern.test(sourceCommit)) {
    throw new Error("Cannot search for unresolved uploads with an invalid Git commit");
  }
  if (!existsSync(receiptDirectory)) return [];
  const commitSuffix = `.${sourceCommit}${unresolvedUploadSuffix}`;
  return readdirSync(receiptDirectory, {withFileTypes: true})
    .filter((entry) => entry.name.endsWith(commitSuffix))
    .map((entry) => join(receiptDirectory, entry.name))
    .sort();
};

const mutableDependencyCacheDirectories = new Set([".cache", ".rolldown", ".vite", ".vite-temp"]);
const releaseWorkspacePackageDirectories = ["core", "hosted", "solo", "web-game"]
  .map((name) => join("packages", name))
  .concat(["jest", "facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"].map(name => join("platforms", "web", name)));
const dependencyInputs = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  join("firebase-functions", "package.json"),
  join("firebase-functions", "package-lock.json"),
  join("firebase-functions", "packages", "core", "package.json"),
  ...releaseWorkspacePackageDirectories.map((directory) => join(directory, "package.json")),
  "node_modules",
  join("firebase-functions", "node_modules"),
  ...releaseWorkspacePackageDirectories.map((directory) => join(directory, "node_modules")),
];

/** Reuses only the fingerprinted workspace installations inside committed release sources. */
export const linkReleaseSnapshotDependencies = ({repositoryDirectory, immutableSourceDirectory}) => {
  for (const directory of ["", ...releaseWorkspacePackageDirectories]) {
    symlinkSync(
      join(repositoryDirectory, directory, "node_modules"),
      join(immutableSourceDirectory, directory, "node_modules"),
      "dir",
    );
  }
};

const portablePath = (value) => value.split(sep).join("/");

const hashDependencyEntry = (hash, root, absolutePath, workspaceModulesDirectory) => {
  const entry = lstatSync(absolutePath);
  const name = portablePath(relative(root, absolutePath)) || ".";
  const mode = (entry.mode & 0o777).toString(8);
  if (entry.isSymbolicLink()) {
    hash.update(`link\0${name}\0${mode}\0${readlinkSync(absolutePath)}\0`);
    return;
  }
  if (entry.isDirectory()) {
    hash.update(`directory\0${name}\0${mode}\0`);
    for (const child of readdirSync(absolutePath, {withFileTypes: true})
      .filter((candidate) => !mutableDependencyCacheDirectories.has(candidate.name))
      .filter((candidate) => !(absolutePath === workspaceModulesDirectory && (
        candidate.name === ".pnpm-task-run-state-v1" && candidate.isDirectory() ||
        candidate.name === ".pnpm-workspace-state-v1.json" && candidate.isFile()
      )))
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      hashDependencyEntry(hash, root, join(absolutePath, child.name), workspaceModulesDirectory);
    }
    return;
  }
  if (entry.isFile()) {
    hash.update(`file\0${name}\0${mode}\0${entry.size}\0`);
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
    return;
  }
  throw new Error(`Unsupported dependency entry in release fingerprint: ${absolutePath}`);
};

export const fingerprintReleaseDependencies = ({repositoryDirectory}) => {
  if (!isAbsolute(repositoryDirectory)) throw new Error("The release repository directory must be absolute");
  const hash = createHash("sha256");
  for (const input of dependencyInputs) {
    const absolutePath = join(repositoryDirectory, input);
    if (!existsSync(absolutePath)) {
      throw new Error(`Missing release dependency input: ${absolutePath}`);
    }
    hash.update(`root\0${portablePath(input)}\0`);
    hashDependencyEntry(hash, absolutePath, absolutePath, join(repositoryDirectory, "node_modules"));
  }
  return hash.digest("hex");
};
