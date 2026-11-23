#!/usr/bin/env node
import {execFile, execFileSync} from "node:child_process";
import {promisify} from "node:util";
import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {developmentSourceDigest} from "./development-source-digest.mjs";
import {executeDevelopmentCheck} from "./development-check-output.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const execute = promisify(execFile);
const selected = new Set(process.argv.slice(2));
if (!selected.size) throw new Error("Specify exact development check IDs to run");
const commands = new Map();
const artifactPaths = new Set();
for (const name of (await readdir(path.join(root, "docs/common/development/development-tasks"))).filter(name => name.endsWith(".json"))) {
  const task = JSON.parse(await readFile(path.join(root, "docs/common/development/development-tasks", name), "utf8"));
  for (const artifact of task.artifacts ?? []) artifactPaths.add(artifact.file);
  for (const check of task.checks ?? []) {
    if (!selected.has(check.id)) continue;
    const key = JSON.stringify([check.executable, check.args]);
    const current = commands.get(key) ?? {...check, ids: [], tasks: []};
    if (!current.ids.includes(check.id)) current.ids.push(check.id);
    if (!current.tasks.includes(task.taskId)) current.tasks.push(task.taskId);
    commands.set(key, current);
  }
}
for (const id of selected) if (![...commands.values()].some(check => check.ids.includes(id))) throw new Error(`Unknown check: ${id}`);
const directory = path.join(root, "artifacts/development-checks");
await mkdir(directory, {recursive: true});
const sourceDigest = await developmentSourceDigest(root);
const reportPath = path.join(directory, "current.json");
let prior;
try {prior = JSON.parse(await readFile(reportPath, "utf8"));} catch (error) {if (error.code !== "ENOENT") throw error;}
const report = {revision: execFileSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"}).trim(), sourceDigest,
  startedAt: new Date().toISOString(), checks: prior?.sourceDigest === sourceDigest ? prior.checks : []};
let failed = false;
// Build artifacts first so subsequent shared receipts all bind the same artifact bytes.
const orderedCommands = [...commands].sort(([, left], [, right]) => Number(right.args.includes("build:all-targets")) - Number(left.args.includes("build:all-targets")));
for (const [key, check] of orderedCommands) {
  console.log(`Running ${check.ids.join(", ")} (${check.tasks.length} task declarations)`);
  const commandDigest = createHash("sha256").update(key).digest("hex");
  let output, status, reason;
  try {
    const result = await executeDevelopmentCheck(check, execute, {cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000});
    output = `${result.stdout}\n${result.stderr}`;
    status = "passed";
  } catch (error) {
    output = `${output ?? `${error.stdout ?? ""}\n${error.stderr ?? ""}`}\n${error.message}`;
    status = "failed"; reason = error.message; failed = true;
  }
  const log = `artifacts/development-checks/${sourceDigest}-${commandDigest}-${createHash("sha256").update(output).digest("hex")}.log`;
  await writeFile(path.join(root, log), output);
  if (await developmentSourceDigest(root) !== sourceDigest) throw new Error("Source changed during verification; no current-source report can be recorded");
  report.checks = report.checks.filter(row => JSON.stringify([row.executable, row.args]) !== key);
  const artifacts = {};
  if (status === "passed") for (const file of artifactPaths) {
    try {artifacts[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");}
    catch (error) {if (error.code !== "ENOENT") throw error;}
  }
  report.checks.push({artifacts, ids: check.ids, executable: check.executable, args: check.args, tasks: check.tasks, status,
    ...(reason ? {reason} : {}), checkedAt: new Date().toISOString(), log, sha256: createHash("sha256").update(output).digest("hex")});
  report.updatedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`${status}: ${check.ids.join(", ")}; exact output saved in ${log}`);
}
if (failed) process.exitCode = 1;
