import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {assertDevelopmentCheckOutput} from "./development-check-output.mjs";

/** Reuses exact successful commands only while their source, logs and every task artifact still match. */
export async function reuseDevelopmentChecks(root, task, report, {revision, sourceDigest}) {
  if (report.revision !== revision || report.sourceDigest !== sourceDigest) throw new Error("Check report source or revision is stale");
  const artifacts = {};
  for (const artifact of task.artifacts ?? []) {
    artifacts[artifact.file] = createHash("sha256").update(await readFile(path.resolve(root, artifact.file))).digest("hex");
  }
  const checks = [];
  const verifiedRows = new Map();
  for (const check of task.checks) {
    const rows = (report.checks ?? []).filter(row => row.executable === check.executable && JSON.stringify(row.args) === JSON.stringify(check.args));
    if (rows.length !== 1 || rows[0].status !== "passed") throw new Error(`Required check ${check.id} has no unique passing report`);
    const row = rows[0];
    const log = path.resolve(root, row.log ?? "");
    if (!path.relative(root, log).startsWith(`artifacts${path.sep}development-checks${path.sep}`)) throw new Error(`Required check ${check.id} has an invalid log path`);
    const output = await readFile(log, "utf8");
    if (createHash("sha256").update(output).digest("hex") !== row.sha256) throw new Error(`Required check ${check.id} log has changed`);
    const raw = output.match(/\nNamed assertion report:\n([\s\S]*?)\nEnd named assertion report\.\n/u)?.[1];
    const passedAssertionNames = raw ? (JSON.parse(raw).testResults ?? []).flatMap(suite => (suite.assertionResults ?? [])
      .filter(assertion => assertion.status === "passed").map(assertion => assertion.fullName)) : undefined;
    assertDevelopmentCheckOutput(check, {stdout: output, passedAssertionNames});
    verifiedRows.set(check.id, row);
    checks.push({id: check.id, status: "passed", evidence: `${check.executable} ${check.args.join(" ")}; current-source check at ${row.checkedAt}; output ${row.log} SHA-256 ${row.sha256}`});
  }
  for (const artifact of task.artifacts ?? []) {
    const owners = artifact.checkId
      ? task.checks.filter(check => check.id === artifact.checkId)
      : task.checks;
    if (!owners.length || (artifact.checkId && owners.length !== 1)) throw new Error(`Artifact ${artifact.file} has an invalid required check binding`);
    if (owners.some(check => verifiedRows.get(check.id)?.artifacts?.[artifact.file] !== artifacts[artifact.file]))
      throw new Error(`Artifact ${artifact.file} artifacts are missing or changed for its required check`);
  }
  return checks;
}
