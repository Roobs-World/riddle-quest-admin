import {execFile, spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {lstat, mkdir, readFile, readlink, rename, unlink, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import {deflateRawSync} from "node:zlib";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {auditYouTubeArtifact} from "./audit-youtube-artifact.mjs";
import {developmentSourcePathspecs} from "../../../../scripts/release/development-source-digest.mjs";
import {getWebBuildPaths} from "../../../../scripts/release/release-registry.mjs";

const execFileAsync = promisify(execFile);
const defaultRepositoryDirectory = fileURLToPath(new URL("../../../..", import.meta.url));
const youtubePaths = getWebBuildPaths("youtube");
const requiredTranslationLocales = [
  "ar", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi",
];
const sha256Pattern = /^[0-9a-f]{64}$/u;
const gitCommitPattern = /^[0-9a-f]{40,64}$/u;

export const youtubeReleaseVerificationSuites = Object.freeze([
  Object.freeze({id: "legacy-target-builds-and-audits", command: "pnpm --filter riddle-quest build:web"}),
  Object.freeze({id: "youtube-release-build-and-audit", command: "pnpm --filter riddle-quest build:youtube"}),
]);

const repositoryChecklist = Object.freeze([
  Object.freeze({id: "content-and-model-audit", evidence: "check:youtube-release-build-and-audit"}),
  Object.freeze({
    id: "four-isolated-builds-and-reciprocal-audits",
    evidence: "check:legacy-target-builds-and-audits,check:youtube-release-build-and-audit",
  }),
]);

const externalChecklist = Object.freeze([
  Object.freeze({
    id: "developer-portal-access-and-role",
    blocker: "Requires a YouTube Playables Developer Portal invitation and Manager or Editor permission.",
  }),
  Object.freeze({
    id: "portal-metadata-and-thumbnails",
    blocker: "Requires owner-approved metadata and the thumbnail assets requested by the current Portal.",
  }),
  Object.freeze({
    id: "google-bundle-analyzer",
    blocker: "Requires a human-run analyzer result bound to the archive SHA-256 in the release manifest.",
  }),
  Object.freeze({
    id: "hosted-test-suite",
    blocker: "Requires Portal ingestion and a hosted Test Suite result bound to the same archive SHA-256.",
  }),
  Object.freeze({
    id: "physical-device-matrix",
    blocker: "Requires desktop web, mobile web, physical Android, and physical iOS evidence bound to the same archive SHA-256.",
  }),
  Object.freeze({
    id: "portal-upload-and-certification",
    blocker: "Requires all hosted and device evidence plus a manual Portal upload and certification submission.",
  }),
]);

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const crcTable = Array.from({length: 256}, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function assertZip32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} exceeds the deterministic ZIP32 boundary`);
  }
}

export function createDeterministicZip(inputEntries) {
  const entries = [...inputEntries].sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (entries.length < 1 || entries.length > 0xffff) throw new Error("Invalid deterministic ZIP entry count");
  const names = new Set();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    if (
      typeof entry.name !== "string" ||
      entry.name.startsWith("/") ||
      entry.name.includes("\\") ||
      entry.name.split("/").some((part) =>
        part === "." || part === ".." || !/^[A-Za-z0-9_.-]+$/u.test(part)
      ) ||
      names.has(entry.name)
    ) throw new Error(`Invalid deterministic ZIP entry: ${entry.name}`);
    names.add(entry.name);
    const contents = Buffer.isBuffer(entry.contents) ? entry.contents : Buffer.from(entry.contents);
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(contents, {level: 9});
    const checksum = crc32(contents);
    assertZip32(contents.byteLength, `${entry.name} uncompressed size`);
    assertZip32(compressed.byteLength, `${entry.name} compressed size`);
    assertZip32(offset, `${entry.name} offset`);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.byteLength, 18);
    local.writeUInt32LE(contents.byteLength, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.byteLength, 20);
    central.writeUInt32LE(contents.byteLength, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.byteLength + name.byteLength + compressed.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const exactKeys = (value, expected) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === [...expected].sort().join(",");

export function validateContentAudit(value, contentManifest) {
  const inputs = value?.inputs;
  const bundles = inputs?.translationBundles;
  const authoring = inputs?.canonicalAuthoring;
  if (
    value?.schemaVersion !== 1 ||
    value.releaseReady !== true ||
    value.contentVersion !== contentManifest.contentVersion ||
    value.runtime?.sha256 !== contentManifest.contentSha256 ||
    value.runtime?.localeCount !== 16 ||
    !Number.isInteger(value.runtime?.riddleCountPerLocale) ||
    value.runtime.riddleCountPerLocale < 180 ||
    value.runtime.riddleCountPerLocale !== contentManifest.classicRiddleCount ||
    !sha256Pattern.test(inputs?.canonicalSourceSha256 ?? "") ||
    !sha256Pattern.test(inputs?.orderManifestSha256 ?? "") ||
    !exactKeys(authoring, [
      "appendReceiptCount",
      "appendReceiptsSha256",
      "criticModel",
      "generatorModel",
      "sourceDescriptorSha256",
    ]) ||
    authoring.sourceDescriptorSha256 !== inputs.canonicalSourceSha256 ||
    !["gpt-5.6-sol", "gpt-6.1-sol"].includes(authoring.generatorModel) ||
    authoring.criticModel !== "gpt-5.5" ||
    authoring.generatorModel === authoring.criticModel ||
    !Number.isSafeInteger(authoring.appendReceiptCount) ||
    authoring.appendReceiptCount < 0 ||
    !sha256Pattern.test(authoring.appendReceiptsSha256 ?? "") ||
    bundles === null ||
    typeof bundles !== "object" ||
    Array.isArray(bundles) ||
    Object.keys(bundles).sort().join(",") !== [...requiredTranslationLocales].sort().join(",")
  ) throw new Error("YouTube release content audit is incomplete or does not match the exact runtime pack");
  for (const locale of requiredTranslationLocales) {
    const bundle = bundles[locale];
    if (
      !sha256Pattern.test(bundle?.sha256 ?? "") ||
      bundle.translatorModel !== "gpt-5.6-sol" ||
      bundle.criticModel !== "gpt-5.5" ||
      bundle.translatorModel === bundle.criticModel
    ) throw new Error(`YouTube ${locale} content audit does not use the approved translator and critic`);
  }
  return value;
}

async function runGit(repositoryDirectory, args) {
  try {
    const result = await execFileAsync("git", ["-C", repositoryDirectory, ...args], {
      encoding: "buffer",
      maxBuffer: 128 * 1024 * 1024,
    });
    return result.stdout;
  } catch (error) {
    throw new Error("YouTube release evidence requires a readable Git worktree", {cause: error});
  }
}

/** Streams a Git command's output into SHA-256 so diffs of any size can be fingerprinted. */
async function hashGitOutput(repositoryDirectory, args) {
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn("git", ["-C", repositoryDirectory, ...args], {stdio: ["ignore", "pipe", "ignore"]});
      const hash = createHash("sha256");
      child.stdout.on("data", (chunk) => hash.update(chunk));
      child.once("error", reject);
      child.once("close", (code, signal) => {
        if (code === 0 && signal === null) resolve(hash.digest("hex"));
        else reject(new Error(`git ${args[0]} failed (exit ${code ?? "none"}, signal ${signal ?? "none"})`));
      });
    });
  } catch (error) {
    throw new Error("YouTube release evidence requires a readable Git worktree", {cause: error});
  }
}

export async function captureSourceIdentity(repositoryDirectory = defaultRepositoryDirectory) {
  const repository = path.resolve(repositoryDirectory);
  const topLevel = (await runGit(repository, ["rev-parse", "--show-toplevel"])).toString("utf8").trim();
  if (path.resolve(topLevel) !== repository) {
    throw new Error("YouTube release evidence must be captured from the repository root");
  }
  const gitCommit = (await runGit(repository, ["rev-parse", "HEAD"])).toString("utf8").trim();
  if (!gitCommitPattern.test(gitCommit)) throw new Error("YouTube release source commit is malformed");
  const [status, trackedDiffSha256, untrackedRaw] = await Promise.all([
    runGit(repository, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...developmentSourcePathspecs]),
    hashGitOutput(repository, ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ...developmentSourcePathspecs]),
    runGit(repository, ["ls-files", "--others", "--exclude-standard", "-z", "--", ...developmentSourcePathspecs]),
  ]);
  const untrackedPaths = untrackedRaw.toString("utf8").split("\0").filter(Boolean).sort((left, right) =>
    left.localeCompare(right, "en")
  );
  const untracked = [];
  for (const relativePath of untrackedPaths) {
    const absolutePath = path.resolve(repository, relativePath);
    if (!absolutePath.startsWith(`${repository}${path.sep}`)) {
      throw new Error("Git returned an unsafe untracked source path");
    }
    const metadata = await lstat(absolutePath);
    let contents;
    let kind;
    if (metadata.isFile()) {
      contents = await readFile(absolutePath);
      kind = "file";
    } else if (metadata.isSymbolicLink()) {
      contents = Buffer.from(await readlink(absolutePath), "utf8");
      kind = "symlink";
    } else {
      throw new Error(`Untracked release source is not a regular file or symlink: ${relativePath}`);
    }
    untracked.push({path: relativePath.split(path.sep).join("/"), kind, sha256: sha256(contents)});
  }
  const dirtyPayload = {
    statusSha256: sha256(status),
    trackedDiffSha256,
    untrackedFilesSha256: sha256(stableJson(untracked)),
    untrackedFileCount: untracked.length,
  };
  const dirtyTreeSha256 = sha256(stableJson(dirtyPayload));
  return {
    gitCommit,
    state: status.byteLength === 0 ? "clean" : "dirty",
    dirtyTreeSha256,
    snapshotSha256: sha256(stableJson({gitCommit, dirtyTreeSha256})),
  };
}

async function readArtifactEntries(audit) {
  return Promise.all(audit.files.map(async (file) => ({
    name: path.relative(audit.root, file).split(path.sep).join("/"),
    contents: await readFile(file),
  })));
}

export function createArtifactIdentity(audit, entries) {
  const files = entries.map(({name, contents}) => ({
    path: name,
    bytes: contents.byteLength,
    sha256: sha256(contents),
  }));
  return {
    filesSha256: sha256(stableJson(files)),
    fileCount: files.length,
    totalBytes: audit.totalBytes,
    initialBytes: audit.initialBytes,
    contentVersion: audit.contentManifest.contentVersion,
    contentSha256: audit.contentManifest.contentSha256,
  };
}

function sameValue(left, right) {
  return stableJson(left) === stableJson(right);
}

function validateSourceIdentity(source) {
  return exactKeys(source, ["dirtyTreeSha256", "gitCommit", "snapshotSha256", "state"]) &&
    gitCommitPattern.test(source.gitCommit ?? "") &&
    ["clean", "dirty"].includes(source.state) &&
    sha256Pattern.test(source.dirtyTreeSha256 ?? "") &&
    sha256Pattern.test(source.snapshotSha256 ?? "") &&
    source.snapshotSha256 === sha256(stableJson({
      gitCommit: source.gitCommit,
      dirtyTreeSha256: source.dirtyTreeSha256,
    }));
}

function validateVerificationReport(report, {source, artifact, contentAuditSha256}) {
  const expectedChecks = youtubeReleaseVerificationSuites;
  if (
    !exactKeys(report, [
      "artifact",
      "capturedAt",
      "certificationChecklist",
      "contentAudit",
      "kind",
      "provider",
      "schemaVersion",
      "source",
      "checks",
    ]) ||
    report.schemaVersion !== 2 ||
    report.provider !== "youtube-playables" ||
    report.kind !== "build-and-audit-verification" ||
    typeof report.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(report.capturedAt)) ||
    !validateSourceIdentity(report.source) ||
    !sameValue(report.source, source)
  ) throw new Error("YouTube verification report is malformed or stale for the current source tree");
  if (!sameValue(report.artifact, artifact)) {
    throw new Error("YouTube verification report is stale for the exact expanded artifact");
  }
  if (
    !exactKeys(report.contentAudit, ["contentVersion", "sha256"]) ||
    report.contentAudit.sha256 !== contentAuditSha256 ||
    report.contentAudit.contentVersion !== artifact.contentVersion
  ) throw new Error("YouTube verification report is stale for the exact content/model audit");
  if (!Array.isArray(report.checks) || report.checks.length !== expectedChecks.length) {
    throw new Error("YouTube verification report does not contain the exact required build and audit checks");
  }
  for (let index = 0; index < expectedChecks.length; index += 1) {
    const result = report.checks[index];
    const expected = expectedChecks[index];
    if (
      !exactKeys(result, ["command", "exitCode", "id", "status", "stderrSha256", "stdoutSha256"]) ||
      result.id !== expected.id ||
      result.command !== expected.command ||
      result.status !== "passed" ||
      result.exitCode !== 0 ||
      !sha256Pattern.test(result.stdoutSha256 ?? "") ||
      !sha256Pattern.test(result.stderrSha256 ?? "")
    ) throw new Error(`YouTube verification report has no passing evidence for ${expected.id}`);
  }
  const repository = report.certificationChecklist?.repository;
  const external = report.certificationChecklist?.external;
  if (
    !exactKeys(report.certificationChecklist, ["external", "repository"]) ||
    !Array.isArray(repository) ||
    repository.length !== repositoryChecklist.length ||
    !Array.isArray(external) ||
    external.length !== externalChecklist.length
  ) throw new Error("YouTube verification report certification checklist is incomplete");
  repositoryChecklist.forEach((expected, index) => {
    const actual = repository[index];
    if (
      !exactKeys(actual, ["evidence", "id", "status"]) ||
      actual.id !== expected.id ||
      actual.status !== "passed" ||
      actual.evidence !== expected.evidence
    ) throw new Error(`YouTube repository certification gate is not passed: ${expected.id}`);
  });
  externalChecklist.forEach((expected, index) => {
    const actual = external[index];
    if (
      !exactKeys(actual, ["blocker", "evidence", "id", "status"]) ||
      actual.id !== expected.id ||
      actual.status !== "blocked" ||
      actual.evidence !== null ||
      actual.blocker !== expected.blocker
    ) throw new Error(`YouTube external certification gate is not explicitly blocked: ${expected.id}`);
  });
  return report;
}

export function createYouTubeVerificationReport({capturedAt, source, artifact, contentAuditSha256, checks}) {
  const report = {
    schemaVersion: 2,
    provider: "youtube-playables",
    kind: "build-and-audit-verification",
    capturedAt,
    source,
    artifact,
    contentAudit: {contentVersion: artifact.contentVersion, sha256: contentAuditSha256},
    checks,
    certificationChecklist: {
      repository: repositoryChecklist.map(({id, evidence}) => ({id, status: "passed", evidence})),
      external: externalChecklist.map(({id, blocker}) => ({id, status: "blocked", evidence: null, blocker})),
    },
  };
  return validateVerificationReport(report, {source, artifact, contentAuditSha256});
}

async function atomicWrite(filePath, contents) {
  await mkdir(path.dirname(filePath), {recursive: true, mode: 0o700});
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, contents, {flag: "wx", mode: 0o600});
    await rename(temporary, filePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function repositoryRelativePath(repositoryDirectory, candidate, label) {
  const relativePath = path.relative(repositoryDirectory, path.resolve(candidate));
  if (relativePath === "" || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a file inside the repository`);
  }
  return relativePath.split(path.sep).join("/");
}

export async function writeYouTubeVerificationReport({
  repositoryDirectory = defaultRepositoryDirectory,
  distDirectory,
  contentAuditPath,
  reportPath,
  checks,
  expectedSource,
  capturedAt = new Date().toISOString(),
} = {}) {
  const repository = path.resolve(repositoryDirectory);
  const resolvedDist = path.resolve(distDirectory ?? path.join(repository, youtubePaths.outputDirectory));
  const resolvedContentAudit = path.resolve(contentAuditPath ?? path.join(
    repository,
    "firebase-functions/artifacts/youtube-content/youtube-content-v1.audit.json",
  ));
  const resolvedReport = path.resolve(reportPath ?? path.join(repository, youtubePaths.buildDirectory, "build-youtube.test-report.json"));
  repositoryRelativePath(repository, resolvedReport, "YouTube verification report");
  if (resolvedReport.startsWith(`${resolvedDist}${path.sep}`)) throw new Error("YouTube verification report must be outside the runtime artifact");
  const audit = await auditYouTubeArtifact(resolvedDist);
  const entries = await readArtifactEntries(audit);
  const artifact = createArtifactIdentity(audit, entries);
  const contentAuditSource = await readFile(resolvedContentAudit);
  let contentAudit;
  try {
    contentAudit = JSON.parse(contentAuditSource.toString("utf8"));
  } catch (error) {
    throw new Error("YouTube release content audit is not valid JSON", {cause: error});
  }
  validateContentAudit(contentAudit, audit.contentManifest);
  const source = await captureSourceIdentity(repository);
  if (expectedSource !== undefined && (!validateSourceIdentity(expectedSource) || !sameValue(source, expectedSource))) {
    throw new Error("YouTube source tree changed during release verification");
  }
  const report = createYouTubeVerificationReport({
    capturedAt,
    source,
    artifact,
    contentAuditSha256: sha256(contentAuditSource),
    checks,
  });
  const confirmedSource = await captureSourceIdentity(repository);
  if (!sameValue(source, confirmedSource)) {
    throw new Error("YouTube source tree changed while capturing the verification report");
  }
  await atomicWrite(resolvedReport, stableJson(report));
  return {reportPath: resolvedReport, report};
}

export async function packageYouTubeArtifact(options = {}) {
  const repository = path.resolve(options.repositoryDirectory ?? defaultRepositoryDirectory);
  const resolvedDist = path.resolve(options.distDirectory ?? path.join(repository, youtubePaths.outputDirectory));
  const resolvedArchive = path.resolve(options.archivePath ?? path.join(repository, youtubePaths.buildDirectory, "build-youtube.zip"));
  const resolvedManifest = path.resolve(options.manifestPath ?? path.join(repository, youtubePaths.buildDirectory, "build-youtube.manifest.json"));
  const resolvedContentAudit = path.resolve(options.contentAuditPath ?? path.join(
    repository,
    "firebase-functions/artifacts/youtube-content/youtube-content-v1.audit.json",
  ));
  const resolvedReport = path.resolve(options.reportPath ?? path.join(repository, youtubePaths.buildDirectory, "build-youtube.test-report.json"));
  for (const output of [resolvedArchive, resolvedManifest, resolvedReport]) repositoryRelativePath(repository, output, "YouTube release output");
  if (
    resolvedArchive === resolvedManifest ||
    resolvedArchive === resolvedReport ||
    resolvedManifest === resolvedReport ||
    resolvedArchive.startsWith(`${resolvedDist}${path.sep}`) ||
    resolvedManifest.startsWith(`${resolvedDist}${path.sep}`) ||
    resolvedReport.startsWith(`${resolvedDist}${path.sep}`)
  ) throw new Error("YouTube release ZIP, manifest, and verification report must be distinct outputs inside the repository and outside the runtime artifact");

  const audit = await auditYouTubeArtifact(resolvedDist);
  let contentAuditSource;
  try {
    contentAuditSource = await readFile(resolvedContentAudit);
  } catch (error) {
    throw new Error("YouTube release packaging requires the full content/model audit", {cause: error});
  }
  let contentAudit;
  try {
    contentAudit = validateContentAudit(JSON.parse(contentAuditSource.toString("utf8")), audit.contentManifest);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("YouTube release content audit is not valid JSON", {cause: error});
    throw error;
  }

  const entries = await readArtifactEntries(audit);
  const artifactIdentity = createArtifactIdentity(audit, entries);
  const sourceIdentity = await captureSourceIdentity(repository);
  let reportSource;
  try {
    reportSource = await readFile(resolvedReport);
  } catch (error) {
    throw new Error("YouTube release packaging requires a fresh machine-readable verification report", {cause: error});
  }
  let report;
  try {
    report = JSON.parse(reportSource.toString("utf8"));
  } catch (error) {
    throw new Error("YouTube verification report is not valid JSON", {cause: error});
  }
  validateVerificationReport(report, {
    source: sourceIdentity,
    artifact: artifactIdentity,
    contentAuditSha256: sha256(contentAuditSource),
  });

  const archive = createDeterministicZip(entries);
  const fileRecords = entries.map(({name, contents}) => ({
    path: name,
    bytes: contents.byteLength,
    sha256: sha256(contents),
  }));
  const manifest = {
    schemaVersion: 2,
    provider: "youtube-playables",
    intent: "manual-developer-portal-upload",
    source: sourceIdentity,
    archive: {
      file: path.basename(resolvedArchive),
      bytes: archive.byteLength,
      entries: entries.length,
      sha256: sha256(archive),
      rootEntry: "index.html",
      deterministicTimestamp: "1980-01-01T00:00:00.000Z",
    },
    content: audit.contentManifest,
    contentAudit: {
      file: repositoryRelativePath(repository, resolvedContentAudit, "YouTube content audit"),
      bytes: contentAuditSource.byteLength,
      sha256: sha256(contentAuditSource),
      schemaVersion: contentAudit.schemaVersion,
      contentVersion: contentAudit.contentVersion,
      releaseReady: contentAudit.releaseReady,
      inputs: contentAudit.inputs,
      runtime: contentAudit.runtime,
    },
    verification: {
      file: repositoryRelativePath(repository, resolvedReport, "YouTube verification report"),
      bytes: reportSource.byteLength,
      sha256: sha256(reportSource),
      report,
    },
    files: fileRecords,
  };
  const confirmedSource = await captureSourceIdentity(repository);
  if (!sameValue(sourceIdentity, confirmedSource)) {
    throw new Error("YouTube source tree changed while packaging the release artifact");
  }
  await atomicWrite(resolvedArchive, archive);
  await atomicWrite(resolvedManifest, stableJson(manifest));
  return {archivePath: resolvedArchive, manifestPath: resolvedManifest, manifest};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length > 2) throw new Error("youtube-release-artifact.mjs does not accept positional arguments");
  const result = await packageYouTubeArtifact();
  console.log(
    `YouTube upload ZIP ready: ${result.archivePath} ` +
      `(${result.manifest.archive.bytes} bytes, sha256 ${result.manifest.archive.sha256})`,
  );
  console.log(`Release manifest: ${result.manifestPath}`);
}
