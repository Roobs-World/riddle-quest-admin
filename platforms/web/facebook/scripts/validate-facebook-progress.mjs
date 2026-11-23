import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {fileURLToPath, pathToFileURL} from "node:url";

const STATUS_VALUES = new Set(["Not Started", "In Progress", "Blocked", "Complete"]);
const EXPECTED_IDS = [6, 7, 7, 8, 7, 11, 7].flatMap((count, phase) =>
  Array.from({length: count}, (_, index) => `P${phase}-${String(index + 1).padStart(2, "0")}`));

export function readProgressData(source) {
  const start = source.indexOf("const UPDATED_AT = ");
  const end = source.indexOf("const statusClass = ", start);
  if (start < 0 || end < 0) throw new Error("tracker-data-block-missing");
  const sandbox = {};
  runInNewContext(`${source.slice(start, end)}\nglobalThis.__result = {UPDATED_AT, TASKS};`, sandbox, {
    timeout: 1_000,
  });
  return sandbox.__result;
}

export function validateProgressTracker(source, {requireComplete = false} = {}) {
  const {UPDATED_AT, TASKS} = readProgressData(source);
  const errors = [];
  const ids = TASKS.map(({id}) => id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) errors.push("task IDs/order must be exactly P0-01 through P6-07");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(UPDATED_AT)) {
    errors.push("UPDATED_AT must be an offset ISO timestamp");
  }
  for (const task of TASKS) {
    for (const field of ["id", "phase", "description", "status", "acceptance", "evidence", "updatedAt"]) {
      if (typeof task[field] !== "string" || task[field].trim() === "") errors.push(`${task.id}: missing ${field}`);
    }
    if (!STATUS_VALUES.has(task.status)) errors.push(`${task.id}: unsupported status ${task.status}`);
    if (task.updatedAt !== UPDATED_AT) errors.push(`${task.id}: stale timestamp`);
    if (task.status === "Complete") {
      if (task.evidence.startsWith("Expected:")) errors.push(`${task.id}: complete task still has expected evidence`);
      if (task.blocker) errors.push(`${task.id}: complete task still has a blocker`);
    } else if (!task.evidence.startsWith("Expected:")) {
      errors.push(`${task.id}: incomplete task evidence must be labelled Expected`);
    }
    if (task.status === "Blocked" && !task.blocker) errors.push(`${task.id}: blocked task needs a blocker`);
  }
  if (requireComplete && TASKS.some(({status}) => status !== "Complete")) {
    errors.push("final gate requires every task to be Complete");
  }
  for (const hook of ["complete-count", "in-progress-count", "blocked-count", "not-started-count", "progress-label", "progress-bar"]) {
    if (!source.includes(`id="${hook}"`)) errors.push(`missing summary hook ${hook}`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    total: TASKS.length,
    complete: TASKS.filter(({status}) => status === "Complete").length,
    updatedAt: UPDATED_AT,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = fileURLToPath(new URL("../../../../docs/facebook/facebook-instant-games-progress.html", import.meta.url));
  const result = validateProgressTracker(readFileSync(path, "utf8"), {
    requireComplete: process.argv.includes("--require-complete"),
  });
  const percentage = Math.round((result.complete / result.total) * 100);
  console.log(`Facebook progress tracker passed: ${result.complete}/${result.total} complete (${percentage}%), ${result.updatedAt}`);
}
