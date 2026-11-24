import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {targetDependencyEvidencePath} from "./build/webTargetDependencies.ts";

/** Binds the hosted push exception to the actual bundle and its audited module inventory. */
export async function hasAuditedHostedNotifications({target, root, files}) {
  const manifestFile = path.join(root, "hosted-notifications-manifest.json");
  if (!files.includes(manifestFile)) return false;
  if (!["yahoo", "facebook"].includes(target)) throw new Error(`Hosted notifications are not admitted for ${target}`);
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  if (manifest.version !== 1 || manifest.target !== target || manifest.apiBase !== "/api/notifications" ||
      manifest.workerPath !== "/hosted-notifications-worker.js") {
    throw new Error("Invalid hosted notification artifact manifest");
  }
  const evidenceFile = targetDependencyEvidencePath(target, root);
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  if (evidence.schemaVersion !== 1 || evidence.target !== target || path.resolve(evidence.outputDirectory) !== root ||
      !Array.isArray(evidence.modules) || !evidence.modules.includes("src/notifications/browser/hostedPush/api.ts") ||
      !Array.isArray(evidence.chunks) || !evidence.chunks.some(chunk => chunk.file === "hosted-notifications-worker.js") ||
      !Array.isArray(evidence.files) || evidence.files.length !== files.length) {
    throw new Error("Hosted notification dependency evidence is missing or mismatched");
  }
  const seen = new Set();
  for (const row of evidence.files) {
    if (typeof row.file !== "string" || typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(row.sha256)) throw new Error("Invalid hosted notification file evidence");
    const file = path.resolve(root, row.file);
    if (seen.has(file) || !files.includes(file) || createHash("sha256").update(await readFile(file)).digest("hex") !== row.sha256) {
      throw new Error("Hosted notification artifact differs from its audited build");
    }
    seen.add(file);
  }
  return true;
}
