import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {
  captureSourceIdentity,
  writeYouTubeVerificationReport,
  youtubeReleaseVerificationSuites,
} from "./youtube-release-artifact.mjs";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));

const invocations = Object.freeze([
  Object.freeze({args: ["--dir", "firebase-functions", "test:youtube-content"]}),
  Object.freeze({args: ["--filter", "@riddle-quest/portal", "test:youtube:unit"]}),
  Object.freeze({args: ["--filter", "@riddle-quest/portal", "build:web"]}),
  Object.freeze({args: ["--filter", "@riddle-quest/portal", "build:youtube"]}),
  Object.freeze({args: ["--filter", "@riddle-quest/portal", "test:release-scripts"]}),
  Object.freeze({
    args: ["--filter", "@riddle-quest/portal", "test:jest-local:playwright"],
    environment: {PORTAL_USE_EXISTING_BUILD: "1"},
  }),
  Object.freeze({
    args: ["--filter", "@riddle-quest/portal", "test:facebook:playwright"],
    environment: {PORTAL_USE_EXISTING_BUILD: "1"},
  }),
  Object.freeze({
    args: ["--filter", "@riddle-quest/portal", "test:reddit:playwright"],
    environment: {PORTAL_USE_EXISTING_BUILD: "1"},
  }),
  Object.freeze({
    args: ["--filter", "@riddle-quest/portal", "test:youtube:playwright"],
    environment: {PORTAL_USE_EXISTING_BUILD: "1"},
  }),
]);

if (invocations.length !== youtubeReleaseVerificationSuites.length) {
  throw new Error("YouTube release verification suite/invocation mismatch");
}

export async function runVerificationCommand(suite, invocation, {cwd = repositoryDirectory} = {}) {
  process.stdout.write(`\n[YouTube release evidence] ${suite.command}\n`);
  const stdoutHash = createHash("sha256");
  const stderrHash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", invocation.args, {
      cwd,
      env: {...process.env, ...invocation.environment},
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      stdoutHash.update(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrHash.update(chunk);
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error(
        `YouTube release verification failed for ${suite.id} ` +
        `(exit ${code ?? "none"}, signal ${signal ?? "none"})`,
      ));
    });
  });
  return {stdoutSha256: stdoutHash.digest("hex"), stderrSha256: stderrHash.digest("hex")};
}

export async function runYouTubeReleaseVerification({
  repository = repositoryDirectory,
  distDirectory = path.join(repository, "builds/youtube"),
  contentAuditPath = path.join(
    repository,
    "firebase-functions/artifacts/youtube-content/youtube-content-v1.audit.json",
  ),
  reportPath = path.join(repository, "build-youtube.test-report.json"),
  commandRunner = runVerificationCommand,
  capturedAt = new Date().toISOString(),
} = {}) {
  const expectedSource = await captureSourceIdentity(repository);
  const tests = [];
  for (let index = 0; index < youtubeReleaseVerificationSuites.length; index += 1) {
    const suite = youtubeReleaseVerificationSuites[index];
    const output = await commandRunner(suite, invocations[index], {cwd: repository});
    if (
      output === null ||
      typeof output !== "object" ||
      !/^[0-9a-f]{64}$/u.test(output.stdoutSha256 ?? "") ||
      !/^[0-9a-f]{64}$/u.test(output.stderrSha256 ?? "")
    ) throw new Error(`YouTube release verification runner returned invalid evidence for ${suite.id}`);
    if (JSON.stringify(await captureSourceIdentity(repository)) !== JSON.stringify(expectedSource)) {
      throw new Error(`YouTube source tree changed during release verification (${suite.id})`);
    }
    tests.push({
      id: suite.id,
      command: suite.command,
      status: "passed",
      exitCode: 0,
      stdoutSha256: output.stdoutSha256,
      stderrSha256: output.stderrSha256,
    });
  }
  return writeYouTubeVerificationReport({
    repositoryDirectory: repository,
    distDirectory,
    contentAuditPath,
    reportPath,
    tests,
    expectedSource,
    capturedAt,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length > 2) {
    throw new Error("youtube-release-artifact-evidence.mjs does not accept positional arguments");
  }
  const result = await runYouTubeReleaseVerification();
  console.log(`YouTube release verification report ready: ${result.reportPath}`);
  console.log(
    `Source snapshot: ${result.report.source.gitCommit} (${result.report.source.state}, ` +
      `${result.report.source.snapshotSha256})`,
  );
  console.log(`Expanded artifact fingerprint: ${result.report.artifact.filesSha256}`);
}
