import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const trackerPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) :
  path.join(repository, "docs/reddit/reddit-games-progress.html");
const source = fs.readFileSync(trackerPath, "utf8");
const tasks = source.split("\n").filter((line) => /^\s*t\("R\d-\d{2}"/.test(line)).map((line) => {
  const match = line.trim().match(/^t\((.*)\),?$/u);
  if (!match) throw new Error("invalid Reddit tracker task");
  const [id, , , , evidence, blocker = "", status = "Not Started"] = JSON.parse(`[${match[1]}]`);
  return {id, evidence, blocker, status};
});
if (tasks.length !== 49) throw new Error(`expected 49 Reddit tasks, found ${tasks.length}`);
const remaining = tasks.filter(({id, status}) => id !== "R6-06" && status !== "Complete");
const promotion = tasks.find(({id}) => id === "R6-06");
if (!promotion || promotion.status !== "Blocked" || !promotion.blocker) {
  throw new Error("R6-06 must remain Blocked until promotion succeeds");
}
if (remaining.length) {
  throw new Error(`Reddit promotion blocked by ${remaining.map(({id, status}) => `${id}:${status}`).join(",")}`);
}
if (tasks.some(({status, evidence}) => status === "Complete" && !String(evidence).trim())) {
  throw new Error("completed Reddit task lacks evidence");
}
console.log("Reddit promotion readiness passed: 48/49 prerequisite tasks Complete; R6-06 is the sole blocked action.");
