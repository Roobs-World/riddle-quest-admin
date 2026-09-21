#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {cp, mkdir, mkdtemp, readFile, readdir, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium, serveArtifact, verifySoloArtifact} from "./browser-artifact-support.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const target = process.argv[2];
if (!["web", "pwa"].includes(target)) throw new Error("Choose web or pwa");
const execute = promisify(execFile);
const project = `riddle-quest-${target}`;
const command = target === "pwa" ? "release:microsoft-pwa" : "release:html5";
console.log(`Preparing ${project}; production deployment follows a browser gate.`);
await execute("pnpm", [command], {cwd: root, maxBuffer: 16 * 1024 * 1024});
const directory = path.join(root, "packages/portal", target === "pwa" ? "dist-microsoft-pwa" : "dist-netflix");
const stage = await mkdtemp(path.join(tmpdir(), `riddle-deploy-${target}-`));
const output = path.join(stage, ".vercel/output");
await mkdir(output, {recursive: true});
await cp(directory, path.join(output, "static"), {recursive: true});
await writeFile(path.join(output, "config.json"), JSON.stringify({version: 3}) + "\n");
const server = await serveArtifact(path.join(output, "static"));
const browser = await chromium.launch({headless: true});
const report = {target, project, verifiedAt: new Date().toISOString(), providerPublication: false};
try {
  report.local = await verifySoloArtifact(browser, server.url, {offline: target === "pwa"});
  await server.close();
  if (process.argv.includes("--prepare-only")) {
    console.log(`Verified deployable output: ${output}`);
  } else {
    const existingIndex = process.argv.indexOf("--verify-existing");
    let deploymentUrl = existingIndex < 0 ? undefined : process.argv[existingIndex + 1];
    if (existingIndex >= 0 && !deploymentUrl?.startsWith("https://")) throw new Error("--verify-existing requires an HTTPS deployment URL");
    if (!deploymentUrl) {
      const {orgId} = JSON.parse(await readFile(path.join(root, ".vercel/project.json"), "utf8"));
      await execute("vercel", ["link", "--yes", "--project", project, "--scope", orgId], {cwd: stage});
      const deployment = await execute("vercel", ["deploy", "--prebuilt", "--prod", "--yes", "--format", "json"], {cwd: stage, maxBuffer: 4 * 1024 * 1024});
      await writeFile(path.join(stage, "deployment-output.json"), deployment.stdout, {mode: 0o600});
      const result = JSON.parse(deployment.stdout);
      deploymentUrl = (result.deployment ?? result).url;
    }
    if (!deploymentUrl) throw new Error(`Deployment URL missing; reconcile ${stage} before retrying`);
    const inspection = await execute("vercel", ["inspect", deploymentUrl, "--format", "json"], {cwd: root});
    const deployed = JSON.parse(inspection.stdout);
    if (deployed.readyState !== "READY") throw new Error("Deployment is not READY");
    // Unique deployment URLs can require Vercel login; exercise the public production alias.
    const hostname = deployed.aliases?.find(value => value === `${project}.vercel.app`) ?? deployed.aliases?.[0] ?? deployed.url;
    const url = hostname ? (hostname.startsWith("https://") ? hostname : `https://${hostname}`) : undefined;
    if (!url) throw new Error("Deployment returned no URL; inspect Vercel before retrying.");
    report.url = url;
    console.log(`Deployed ${url}; verifying exact bytes and live gameplay.`);
    const files = (await readdir(path.join(output, "static"), {recursive: true, withFileTypes: true})).filter(entry => entry.isFile());
    const hash = createHash("sha256");
    for (const file of files.sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`))) {
      const filename = path.join(file.parentPath, file.name);
      const relative = path.relative(path.join(output, "static"), filename).split(path.sep).join("/");
      const local = await readFile(filename);
      const response = await fetch(new URL(relative, `${url}/`));
      if (!response.ok || !local.equals(Buffer.from(await response.arrayBuffer()))) throw new Error(`Deployed artifact mismatch: ${relative}`);
      hash.update(relative).update(local);
    }
    report.artifactSha256 = hash.digest("hex");
    report.filesVerified = files.length;
    report.live = await verifySoloArtifact(browser, `${url}/`, {offline: target === "pwa"});
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  await browser.close();
  await mkdir(path.join(root, "artifacts/release-e2e"), {recursive: true});
  await writeFile(path.join(root, `artifacts/release-e2e/deploy-${target}.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
