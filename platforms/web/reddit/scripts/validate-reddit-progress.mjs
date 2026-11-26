import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const trackerPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repository, "docs/reddit/reddit-games-progress.html");
const source = fs.readFileSync(trackerPath, "utf8");
const statuses = new Set(["Not Started", "In Progress", "Blocked", "Complete"]);
const taskLines = source.split("\n").filter((line) => /^\s*t\("R\d-\d{2}"/.test(line));
const tasks = taskLines.map((line) => {
  const match = line.trim().match(/^t\((.*)\),?$/);
  if (!match) throw new Error(`Cannot parse task line: ${line.trim()}`);
  const [id, phase, description, acceptance, evidence, blocker = "", status = "Not Started"] = JSON.parse(`[${match[1]}]`);
  return { id, phase, description, acceptance, evidence, blocker, status };
});

const errors = [];
const expectedIds = [
  ...Array.from({ length: 7 }, (_, index) => `R0-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 6 }, (_, index) => `R1-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 8 }, (_, index) => `R2-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 8 }, (_, index) => `R3-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, index) => `R4-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, index) => `R5-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 6 }, (_, index) => `R6-${String(index + 1).padStart(2, "0")}`),
];

if (tasks.length !== expectedIds.length) errors.push(`expected ${expectedIds.length} parseable tasks, found ${tasks.length}`);
const ids = tasks.map(({ id }) => id);
if (new Set(ids).size !== ids.length) errors.push("task IDs must be unique");
for (const id of expectedIds) if (!ids.includes(id)) errors.push(`missing task ${id}`);
for (const task of tasks) {
  if (!statuses.has(task.status)) errors.push(`${task.id}: unsupported status ${task.status}`);
  for (const field of ["phase", "description", "acceptance", "evidence"]) {
    if (!task[field].trim()) errors.push(`${task.id}: ${field} is required`);
  }
  if (task.status === "Complete" && /^(expected|todo|tbd)\b/i.test(task.evidence.trim())) {
    errors.push(`${task.id}: completed evidence is only a placeholder`);
  }
  if (task.status === "Blocked" && !task.blocker.trim()) errors.push(`${task.id}: blocked tasks require a blocker`);
}
for (const column of ["ID", "Phase", "Description", "Status", "Acceptance criteria", "Evidence link or command", "Blocker", "Last updated"]) {
  if (!source.includes(`<th>${column}</th>`)) errors.push(`missing table column: ${column}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const complete = tasks.filter(({ status }) => status === "Complete").length;
  console.log(`Reddit tracker valid: ${complete}/${tasks.length} complete (${Math.round((complete / tasks.length) * 100)}%).`);
}
