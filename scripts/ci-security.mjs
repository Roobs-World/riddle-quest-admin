import {readdirSync, readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const workflowDirectory = `${repositoryRoot}.github/workflows`;

/** Extracts top-level job bodies without requiring workflow execution. */
function readJobBlocks(source) {
  const lines = source.split(/\r?\n/u);
  const jobsStart = lines.findIndex((line) => line === "jobs:");
  if (jobsStart < 0) return [];
  const blocks = [];
  for (let index = jobsStart + 1; index < lines.length; index += 1) {
    const match = /^  ([a-zA-Z0-9_-]+):\s*$/u.exec(lines[index]);
    if (!match) continue;
    let end = index + 1;
    while (end < lines.length && (lines[end].startsWith("    ") || lines[end].trim() === "")) end += 1;
    blocks.push({name: match[1], source: lines.slice(index, end).join("\n")});
    index = end - 1;
  }
  return blocks;
}

/** Returns security violations in one GitHub Actions workflow. */
export function auditWorkflowSource(name, source) {
  const failures = [];
  if (/^\s*pull_request_target\s*:/mu.test(source)) {
    failures.push(`${name}: pull_request_target is forbidden because it exposes privileged context to forked code`);
  }
  const permissions = /^permissions:\s*\n((?:  [^\n]*\n?)*)/mu.exec(source)?.[1]?.trim();
  if (permissions !== "contents: read") {
    failures.push(`${name}: workflow permissions must be limited to contents: read`);
  }

  const actionReferences = [...source.matchAll(/^\s*-\s+uses:\s*([^\s#]+).*$/gmu)].map((match) => match[1]);
  for (const reference of actionReferences) {
    if (!/@[a-f0-9]{40}$/u.test(reference)) {
      failures.push(`${name}: action ${reference} must be pinned to a full commit SHA`);
    }
  }

  const checkoutSteps = source.split(/(?=^\s*-\s+uses:\s*actions\/checkout@)/gmu).slice(1);
  for (const step of checkoutSteps) {
    const stepBody = step.split(/(?=^\s*-\s+(?:uses|run|name):)/mu)[0];
    if (!/^\s+persist-credentials:\s*false\s*$/mu.test(stepBody)) {
      failures.push(`${name}: every checkout step must disable persisted Git credentials`);
    }
  }

  const jobBlocks = readJobBlocks(source);
  if (jobBlocks.length === 0) failures.push(`${name}: workflow must define at least one job`);
  for (const job of jobBlocks) {
    if (!/^\s{4}timeout-minutes:\s*[1-9]\d*\s*$/mu.test(job.source)) {
      failures.push(`${name}: job ${job.name} must have a finite positive timeout`);
    }
  }
  if (!/pnpm install --frozen-lockfile/u.test(source)) {
    failures.push(`${name}: dependency installation must enforce the committed lockfile`);
  }

  if (name.startsWith("deploy-") || /^name:\s*Deploy\b/mu.test(source)) {
    if (!/^\s{4}environment:\s*[a-z0-9-]*production[a-z0-9-]*\s*$/mu.test(source)) {
      failures.push(`${name}: deployment jobs must use a protected production environment`);
    }
    if (!/^\s{4}if:\s*github\.ref\s*==\s*'refs\/heads\/[a-z0-9._/-]+'\s*$/mu.test(source)) {
      failures.push(`${name}: deployment jobs must be restricted to one explicit branch`);
    }
    if (!/^\s{2}cancel-in-progress:\s*false\s*$/mu.test(source)) {
      failures.push(`${name}: production deployments must not cancel an in-flight release`);
    }
    if (!/^\s{2}workflow_dispatch:\s*$/mu.test(source) || /^\s{2}(?:push|pull_request|schedule):/mu.test(source)) {
      failures.push(`${name}: production deployment must be manual-only`);
    }
  }
  return failures;
}

/** Audits every committed GitHub Actions workflow and throws on unsafe configuration. */
export function auditCiSecurity() {
  const workflowNames = readdirSync(workflowDirectory)
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort();
  if (workflowNames.length === 0) throw new Error("CI security audit found no GitHub Actions workflows");
  const failures = workflowNames.flatMap((name) =>
    auditWorkflowSource(name, readFileSync(`${workflowDirectory}/${name}`, "utf8")),
  );
  if (failures.length > 0) throw new Error(`CI security audit failed:\n- ${failures.join("\n- ")}`);
  return workflowNames.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const workflowCount = auditCiSecurity();
  console.log(`CI security audit passed: ${workflowCount} workflows use least privilege and immutable dependencies.`);
}
