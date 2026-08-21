import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  createFacebookPromotionRecord,
  createFacebookHandoffArchive,
  createFacebookUploadBarrier,
  facebookArtifactSha256,
  facebookUploadBarrierPath,
  loadAndVerifyFacebookArtifact,
  transitionFacebookUploadBarrier,
  verifyFacebookHandoffArchive,
  writeExclusivePrivateFacebookJson,
} from "./facebook-release-artifact.mjs";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const archivePath = path.join(packageDirectory, "build-facebook.zip");
const receiptDirectory = path.join(packageDirectory, ".facebook-upload-receipts");
const receiptPath = path.join(receiptDirectory, "gated-artifact.json");
const promotionPath = path.join(receiptDirectory, "production-promotion.json");

const fail = (message) => {
  throw new Error(`${message}\nUsage:\n` +
    "  pnpm facebook:draft begin\n" +
    "  pnpm facebook:draft ambiguous --reason REASON\n" +
    "  pnpm facebook:draft accept --draft-id ID --evidence /absolute/dashboard-file\n" +
    "  pnpm facebook:draft promote --production-hash SHA256 --evidence /absolute/dashboard-file");
};

const parseOptions = (values) => {
  const result = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || value === undefined || value.startsWith("--") || result.has(name)) {
      fail("Invalid or duplicate Facebook draft option.");
    }
    result.set(name, value);
  }
  return result;
};

const runGit = (args) => {
  const result = spawnSync("/usr/bin/git", args, {cwd: repositoryDirectory, encoding: "utf8"});
  if (result.status !== 0) fail(`git ${args.join(" ")} failed.`);
  return result.stdout.trim();
};

const readGatedState = async () => {
  const gated = JSON.parse(await readFile(receiptPath, "utf8"));
  const sourceCommit = runGit(["rev-parse", "HEAD"]);
  const sourceDirty = Boolean(runGit(["status", "--porcelain=v1", "--untracked-files=all"]));
  const verified = await loadAndVerifyFacebookArtifact({archivePath, receiptPath, sourceCommit, sourceDirty});
  return {gated, verified};
};

const hashEvidenceFile = async (filePath) => {
  if (!path.isAbsolute(filePath)) fail("Dashboard evidence path must be absolute.");
  return facebookArtifactSha256(await readFile(filePath));
};

const [command, ...optionArguments] = process.argv.slice(2);
const options = parseOptions(optionArguments);

if (command === "begin") {
  if (options.size !== 0) fail("begin accepts no options.");
  const {gated, verified} = await readGatedState();
  const handoffPath = await createFacebookHandoffArchive(
    receiptDirectory,
    gated.archive.sha256,
    verified.contents,
  );
  const {barrierPath} = await createFacebookUploadBarrier(receiptDirectory, gated.archive.sha256);
  console.log(`Facebook draft handoff opened for sha256 ${gated.archive.sha256}`);
  console.log(`Upload exactly: ${handoffPath}`);
  console.log(`Barrier: ${barrierPath}`);
} else if (command === "ambiguous") {
  if (options.size !== 1 || !options.has("--reason")) fail("ambiguous requires --reason.");
  const {gated} = await readGatedState();
  await verifyFacebookHandoffArchive(receiptDirectory, gated.archive.sha256);
  const barrierPath = facebookUploadBarrierPath(receiptDirectory, gated.archive.sha256);
  await transitionFacebookUploadBarrier(
    barrierPath,
    "transmitting",
    "ambiguous",
    options.get("--reason"),
  );
  console.log(`Facebook draft handoff marked ambiguous for sha256 ${gated.archive.sha256}`);
  console.log("Do not retransmit; reconcile this exact artifact in Meta before acceptance.");
} else if (command === "accept") {
  if (options.size !== 2 || !options.has("--draft-id") || !options.has("--evidence")) {
    fail("accept requires --draft-id and --evidence.");
  }
  const {gated} = await readGatedState();
  await verifyFacebookHandoffArchive(receiptDirectory, gated.archive.sha256);
  const barrierPath = facebookUploadBarrierPath(receiptDirectory, gated.archive.sha256);
  const current = JSON.parse(await readFile(barrierPath, "utf8"));
  if (current.status !== "transmitting" && current.status !== "ambiguous") {
    fail("Only a transmitting or reconciled ambiguous handoff can be accepted.");
  }
  const evidence = {
    schemaVersion: 1,
    provider: "facebook",
    intent: "non-production-draft",
    draftId: options.get("--draft-id"),
    archiveSha256: gated.archive.sha256,
    dashboardEvidenceSha256: await hashEvidenceFile(options.get("--evidence")),
    acceptedAt: new Date().toISOString(),
  };
  await transitionFacebookUploadBarrier(barrierPath, current.status, "accepted", evidence);
  console.log(`Facebook draft ${evidence.draftId} accepted for sha256 ${gated.archive.sha256}`);
} else if (command === "promote") {
  if (options.size !== 2 || !options.has("--production-hash") || !options.has("--evidence")) {
    fail("promote requires --production-hash and --evidence.");
  }
  const {gated} = await readGatedState();
  await verifyFacebookHandoffArchive(receiptDirectory, gated.archive.sha256);
  const barrierPath = facebookUploadBarrierPath(receiptDirectory, gated.archive.sha256);
  const acceptedBarrier = JSON.parse(await readFile(barrierPath, "utf8"));
  const record = createFacebookPromotionRecord({
    acceptedBarrier,
    productionArchiveSha256: options.get("--production-hash"),
    promotionEvidenceSha256: await hashEvidenceFile(options.get("--evidence")),
  });
  await writeExclusivePrivateFacebookJson(promotionPath, record);
  console.log(`Facebook global promotion recorded for sha256 ${record.archiveSha256}`);
  console.log(`Receipt: ${promotionPath}`);
} else {
  fail("Unknown Facebook draft command.");
}
