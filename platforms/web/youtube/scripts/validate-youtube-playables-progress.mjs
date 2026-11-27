import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_TRACKER = path.join(repository, "docs/youtube/youtube-playables-progress.html");
const STATUSES = new Set(["Not Started", "In Progress", "Blocked", "Complete"]);
const EXPECTED_IDS = [
  ...Array.from({length: 6}, (_, index) => `Y0-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 6}, (_, index) => `Y1-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 6}, (_, index) => `Y2-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 6}, (_, index) => `Y3-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 6}, (_, index) => `Y4-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 6}, (_, index) => `Y5-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({length: 5}, (_, index) => `Y6-${String(index + 1).padStart(2, "0")}`),
];

/** Parses and validates the evidence-backed YouTube delivery tracker. */
export function validateYouTubeProgressTracker(source) {
  const taskLines = source.split("\n").filter((line) => /^\s*t\("Y\d-\d{2}"/.test(line));
  const tasks = [];
  const errors = [];

  for (const line of taskLines) {
    const match = line.trim().match(/^t\((.*)\),?$/);
    if (!match) {
      errors.push(`cannot parse task line: ${line.trim()}`);
      continue;
    }
    try {
      const [id, phase, description, acceptance, evidence, blocker = "", status = "Not Started"] =
        JSON.parse(`[${match[1]}]`);
      tasks.push({id, phase, description, acceptance, evidence, blocker, status});
    } catch (error) {
      errors.push(`cannot parse task ${line.trim()}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (tasks.length !== EXPECTED_IDS.length) {
    errors.push(`expected ${EXPECTED_IDS.length} parseable tasks, found ${tasks.length}`);
  }
  const ids = tasks.map(({id}) => id);
  if (new Set(ids).size !== ids.length) errors.push("task IDs must be unique");
  for (const id of EXPECTED_IDS) if (!ids.includes(id)) errors.push(`missing task ${id}`);

  for (const task of tasks) {
    if (!STATUSES.has(task.status)) errors.push(`${task.id}: unsupported status ${task.status}`);
    for (const field of ["phase", "description", "acceptance", "evidence"]) {
      if (typeof task[field] !== "string" || !task[field].trim()) errors.push(`${task.id}: ${field} is required`);
    }
    if (task.status === "Complete" && /^(expected|todo|tbd)\b/i.test(task.evidence.trim())) {
      errors.push(`${task.id}: completed evidence is only a placeholder`);
    }
    if (task.status === "Blocked" && !task.blocker.trim()) {
      errors.push(`${task.id}: blocked tasks require a concrete blocker`);
    }
  }

  for (const column of [
    "ID", "Phase", "Description", "Status", "Acceptance criteria", "Evidence link or command", "Blocker", "Last updated",
  ]) {
    if (!source.includes(`<th>${column}</th>`)) errors.push(`missing table column: ${column}`);
  }
  for (const control of ["search", "status", "phase"]) {
    if (!source.includes(`id="${control}"`)) errors.push(`missing tracker control: ${control}`);
  }

  return {tasks, errors};
}

function main() {
  const trackerPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_TRACKER;
  const source = fs.readFileSync(trackerPath, "utf8");
  const {tasks, errors} = validateYouTubeProgressTracker(source);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  const complete = tasks.filter(({status}) => status === "Complete").length;
  console.log(`YouTube tracker valid: ${complete}/${tasks.length} complete (${Math.round((complete / tasks.length) * 100)}%).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
