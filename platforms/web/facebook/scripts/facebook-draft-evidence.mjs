import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  createFacebookPromotionRecord,
  createFacebookHandoffArchive,
  createFacebookUploadBarrier,
  facebookArtifactSha256,
  loadAndVerifyFacebookArtifact,
  transitionFacebookUploadBarrier,
  verifyFacebookHandoffArchive,
  writeExclusivePrivateFacebookJson,
} from "./facebook-release-artifact.mjs";

import {assertFacebookHandoffsSettled, loadFacebookHandoff, withFacebookReleaseLock} from "./facebook-release-state.mjs";
import {FacebookUploadError, uploadFacebookArchive, validateFacebookAssetUploadToken} from "./facebook-remote-upload.mjs";

const packageDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const archivePath = path.join(packageDirectory, "build-facebook.zip");
const receiptDirectory = path.join(packageDirectory, ".facebook-upload-receipts");
const receiptPath = path.join(receiptDirectory, "gated-artifact.json");

const fail = (message) => {
  throw new Error(`${message}\nUsage:\n` +
    "  pnpm facebook:draft begin\n" +
    "  pnpm facebook:draft upload --archive-hash SHA256 < /private/asset-upload-token\n" +
    "  pnpm facebook:draft recover --archive-hash SHA256\n" +
    "  pnpm facebook:draft ambiguous --archive-hash SHA256 --reason REASON\n" +
    "  pnpm facebook:draft accept --archive-hash SHA256 --draft-id ID --evidence /absolute/dashboard-file\n" +
    "  pnpm facebook:draft promote --archive-hash SHA256 --production-hash SHA256 --evidence /absolute/dashboard-file");
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

/** Reads a separately granted upload credential without placing it in arguments or receipts. */
const readAssetUploadToken = async () => {
  if (process.stdin.isTTY) fail("Pipe the Meta Asset Upload Access Token to stdin.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 16386) fail("The Meta upload token is too long.");
    chunks.push(Buffer.from(chunk));
  }
  const token = Buffer.concat(chunks).toString("utf8").trim();
  validateFacebookAssetUploadToken(token);
  return token;
};

const [command, ...optionArguments] = process.argv.slice(2);
const options = parseOptions(optionArguments);

await withFacebookReleaseLock(receiptDirectory, async () => {
  if (command === "begin") {
    if (options.size !== 0) fail("begin accepts no options.");
    await assertFacebookHandoffsSettled(receiptDirectory);
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
  } else if (command === "upload") {
    if (options.size !== 1 || !options.has("--archive-hash")) fail("upload requires --archive-hash.");
    if (runGit(["branch", "--show-current"]) !== "main") fail("Facebook uploads require main.");
    await assertFacebookHandoffsSettled(receiptDirectory);
    const {gated, verified} = await readGatedState();
    const hash = options.get("--archive-hash");
    if (hash !== gated.archive.sha256) fail("The requested Facebook hash does not match the gated artifact.");
    const uploadToken = await readAssetUploadToken();
    await createFacebookHandoffArchive(receiptDirectory, hash, verified.contents);
    const {barrierPath} = await createFacebookUploadBarrier(receiptDirectory, hash);
    const remoteReceiptPath = path.join(receiptDirectory, `remote-upload-${hash}.json`);
    let result;
    try {
      result = await uploadFacebookArchive({contents: verified.contents, archiveSha256: hash, token: uploadToken});
      await writeExclusivePrivateFacebookJson(remoteReceiptPath, {
        ...result,
        sourceCommit: gated.source.commit,
        status: "submitted-awaiting-provider-acceptance",
      });
    } catch (error) {
      if (error instanceof FacebookUploadError) {
        try {
          await writeExclusivePrivateFacebookJson(remoteReceiptPath, {
            schemaVersion: 1,
            provider: "facebook",
            intent: "non-production-draft",
            archiveSha256: hash,
            sourceCommit: gated.source.commit,
            status: "reconciliation-required",
            failedStage: error.stage,
            stages: error.stages,
            recordedAt: new Date().toISOString(),
          });
        } catch {
          // The handoff barrier remains authoritative if a diagnostic receipt cannot be saved.
        }
      }
      await transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous",
        "Remote upload did not produce a durable success receipt; reconcile Meta before any retry");
      const diagnostic = error instanceof FacebookUploadError
        ? ` Stage: ${error.stage}; HTTP: ${error.stages.findLast((entry) => entry.stage === error.stage)?.httpStatus ?? "unavailable"}.`
        : "";
      throw new Error(`Facebook upload outcome requires reconciliation for sha256 ${hash}.${diagnostic} Do not retry; inspect Meta Web Hosting.`);
    }
    await transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous",
      "Remote upload completed; provider processing and exact-artifact acceptance still require Meta evidence");
    console.log(`Facebook archive submitted for sha256 ${hash}`);
    if (result.bundleInstanceId) console.log(`Reported bundle: ${result.bundleInstanceId}`);
    console.log(`Submission receipt: ${remoteReceiptPath}`);
    console.log("Verify processing and the exact artifact in Meta Web Hosting, then record acceptance. Do not upload again.");
  } else if (command === "recover") {
    if (options.size !== 1 || !options.has("--archive-hash")) fail("recover requires --archive-hash.");
    const hash = options.get("--archive-hash");
    await assertFacebookHandoffsSettled(receiptDirectory, {recoverHash: hash});
    await verifyFacebookHandoffArchive(receiptDirectory, hash);
    const {barrierPath} = await createFacebookUploadBarrier(receiptDirectory, hash);
    await transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous", "Interrupted local handoff; provider outcome must be reconciled before transmission");
    console.log(`Facebook interrupted handoff ${hash} recovered as ambiguous.`);
    console.log("Do not upload or retransmit; reconcile these exact bytes in Meta first.");
  } else if (command === "ambiguous") {
    if (options.size !== 2 || !options.has("--reason") || !options.has("--archive-hash")) fail("ambiguous requires --archive-hash and --reason.");
    const hash = options.get("--archive-hash");
    const {barrierPath} = await loadFacebookHandoff(receiptDirectory, hash);
    await transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous", options.get("--reason"));
    console.log(`Facebook draft handoff marked ambiguous for sha256 ${hash}`);
    console.log("Do not retransmit; reconcile this exact artifact in Meta before acceptance.");
  } else if (command === "accept") {
    if (options.size !== 3 || !options.has("--archive-hash") || !options.has("--draft-id") || !options.has("--evidence")) {
      fail("accept requires --archive-hash, --draft-id and --evidence.");
    }
    const hash = options.get("--archive-hash");
    const {barrierPath, barrier: current} = await loadFacebookHandoff(receiptDirectory, hash);
    if (current.status !== "transmitting" && current.status !== "ambiguous") {
      fail("Only a transmitting or reconciled ambiguous handoff can be accepted.");
    }
    const evidence = {
      schemaVersion: 1,
      provider: "facebook",
      intent: "non-production-draft",
      draftId: options.get("--draft-id"),
      archiveSha256: hash,
      dashboardEvidenceSha256: await hashEvidenceFile(options.get("--evidence")),
      acceptedAt: new Date().toISOString(),
    };
    await transitionFacebookUploadBarrier(barrierPath, current.status, "accepted", evidence);
    console.log(`Facebook draft ${evidence.draftId} accepted for sha256 ${hash}`);
  } else if (command === "promote") {
    if (options.size !== 3 || !options.has("--archive-hash") || !options.has("--production-hash") || !options.has("--evidence")) {
      fail("promote requires --archive-hash, --production-hash and --evidence.");
    }
    const hash = options.get("--archive-hash");
    const {barrier: acceptedBarrier} = await loadFacebookHandoff(receiptDirectory, hash);
    const promotionPath = path.join(receiptDirectory, `promotion-${hash}.json`);
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
});
