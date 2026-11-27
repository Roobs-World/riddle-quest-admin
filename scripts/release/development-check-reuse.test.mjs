import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {reuseDevelopmentChecks} from "./development-check-reuse.mjs";
const sha = value => createHash("sha256").update(value).digest("hex");
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "development-check-reuse-"));
  try {
    await mkdir(path.join(root, "artifacts/development-checks"), {recursive: true});
    const log = "artifacts/development-checks/result.log";
    await writeFile(path.join(root, log), "Verified build");
    await writeFile(path.join(root, "artifact.html"), "Built artifact");
    const check = {id: "build", executable: "pnpm", args: ["build"]};
    const task = {checks: [check], artifacts: [{target: "facebook", file: "artifact.html"}]};
    const source = {revision: "a".repeat(40), sourceDigest: "b".repeat(64)};
    const report = {...source, checks: [{...check, status: "passed", log, sha256: sha("Verified build"), checkedAt: "2026-10-11T12:00:00Z", artifacts: {"artifact.html": sha("Built artifact")}}]};
    await run({root, task, source, report});
  } finally {await rm(root, {recursive: true, force: true});}
}
test("reuses exact successful current-source checks with unchanged artifact bytes", () => fixture(async ({root, task, source, report}) => {
  const result = await reuseDevelopmentChecks(root, task, report, source);
  assert.equal(result.length, 1); assert.match(result[0].evidence, /current-source check/u);
}));
test("rejects a stale source or revision", () => fixture(async ({root, task, source, report}) => {
  await assert.rejects(reuseDevelopmentChecks(root, task, {...report, sourceDigest: "c".repeat(64)}, source), /stale/u);
  await assert.rejects(reuseDevelopmentChecks(root, task, {...report, revision: "d".repeat(40)}, source), /stale/u);
}));
test("rejects missing, failed, different and duplicate commands", () => fixture(async ({root, task, source, report}) => {
  for (const checks of [[], [{...report.checks[0], status: "failed"}], [{...report.checks[0], args: ["other"]}], [...report.checks, ...report.checks]]) {
    await assert.rejects(reuseDevelopmentChecks(root, task, {...report, checks}, source), /passing report/u);
  }
}));
test("rejects a modified log or path outside the check evidence directory", () => fixture(async ({root, task, source, report}) => {
  await writeFile(path.join(root, report.checks[0].log), "changed");
  await assert.rejects(reuseDevelopmentChecks(root, task, report, source), /log has changed/u);
  report.checks[0].log = "artifact.html";
  await assert.rejects(reuseDevelopmentChecks(root, task, report, source), /invalid log path/u);
}));
test("rejects missing or modified artifact snapshots", () => fixture(async ({root, task, source, report}) => {
  await writeFile(path.join(root, "artifact.html"), "changed");
  await assert.rejects(reuseDevelopmentChecks(root, task, report, source), /artifacts are missing or changed/u);
  report.checks[0].artifacts = {};
  await assert.rejects(reuseDevelopmentChecks(root, task, report, source), /artifacts are missing or changed/u);
}));
test("revalidates every named scenario from the hashed structured assertion log", () => fixture(async ({root, task, source, report}) => {
  task.checks[0].args.push("--testNamePattern=guest|invitation");
  const raw = JSON.stringify({testResults: [{assertionResults: [{status: "passed", fullName: "guest identity"}]}]});
  const output = `Tests: 1 passed, 1 total\nNamed assertion report:\n${raw}\nEnd named assertion report.\n`;
  report.checks[0].sha256 = sha(output);
  await writeFile(path.join(root, report.checks[0].log), output);
  await assert.rejects(reuseDevelopmentChecks(root, task, report, source), /invitation/u);
}));

test("binds a regenerated artifact to its declared producer rather than an earlier type check", () => fixture(async ({root,task,source,report}) => {
  const build=report.checks[0];
  task.checks.unshift({id:"types", executable:"pnpm", args:["types"]});
  report.checks.unshift({...build,id:"types",args:["types"],artifacts:{"artifact.html":sha("Old artifact")}});
  task.artifacts[0].checkId="build";
  assert.equal((await reuseDevelopmentChecks(root,task,report,source)).length,2);
  build.artifacts={};
  report.checks[0].artifacts={"artifact.html":sha("Built artifact")};
  await assert.rejects(reuseDevelopmentChecks(root,task,report,source),/artifacts are missing or changed/u);
}));
test("rejects a producer binding that is outside the required task checks", () => fixture(async ({root,task,source,report}) => {
  task.artifacts[0].checkId="unrelated";
  report.checks.push({...report.checks[0],id:"unrelated",args:["other"]});
  await assert.rejects(reuseDevelopmentChecks(root,task,report,source),/invalid required check binding/u);
}));
test("requires all check snapshots when an artifact has no explicit producer", () => fixture(async ({root,task,source,report}) => {
  task.checks.push({id:"types", executable:"pnpm", args:["types"]});
  report.checks.push({...report.checks[0],id:"types",args:["types"],artifacts:{"artifact.html":sha("Old artifact")}});
  await assert.rejects(reuseDevelopmentChecks(root,task,report,source),/artifacts are missing or changed/u);
}));
