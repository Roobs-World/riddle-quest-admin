import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {validateRedditHostedEvidence} from "./reddit-hosted-evidence.mjs";
import {verifyRedditHandoff} from "./reddit-release-artifact.mjs";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryDirectory = path.resolve(packageDirectory, "../..");

/** Verifies that hosted Reddit evidence names the exact retained candidate handoff. */
export async function verifyRedditPromotion({
  evidencePath = path.join(repositoryDirectory, "docs/evidence/reddit-hosted-evidence.json"),
  receiptPath = path.join(packageDirectory, ".reddit-release-receipts/gated-artifact.json"),
  receiptsDirectory = path.dirname(receiptPath),
} = {}) {
  const [evidenceText, receiptText] = await Promise.all([
    readFile(evidencePath, "utf8"),
    readFile(receiptPath, "utf8"),
  ]);
  const evidence = validateRedditHostedEvidence(JSON.parse(evidenceText));
  const receipt = JSON.parse(receiptText);
  if (
    receipt?.schemaVersion !== 1 ||
    receipt.provider !== "reddit" ||
    receipt.intent !== "unlisted-upload" ||
    receipt.source?.dirty !== false ||
    receipt.source.commit !== evidence.artifact.sourceCommit ||
    receipt.archive?.sha256 !== evidence.artifact.sha256
  ) {
    throw new Error("Reddit hosted evidence does not match the gated candidate receipt");
  }
  const handoff = await verifyRedditHandoff(receiptsDirectory, evidence.artifact.sha256);
  if (handoff.contents.byteLength !== receipt.archive.bytes) {
    throw new Error("Reddit hosted evidence names a handoff with different archive bytes");
  }
  return {evidence, receipt, handoffPath: handoff.archivePath};
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length > 2) throw new Error("verify-reddit-promotion.mjs does not accept arguments");
  const result = await verifyRedditPromotion();
  console.log(
    `Reddit promotion evidence matches ${result.evidence.artifact.version} ` +
    `(${result.evidence.artifact.sha256})`,
  );
}
