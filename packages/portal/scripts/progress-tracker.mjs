import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = path.resolve(packageDir, "../../docs/html5-riddle-quest-progress.html");
const source = await readFile(canonical, "utf8");
const rows = [...source.matchAll(/<tr data-id="([^"]+)" data-status="([^"]+)">([\s\S]*?)<\/tr>/g)];
const allowed = new Set(["not-started", "in-progress", "blocked", "done", "deferred"]);
if (!rows.length) throw new Error("Progress tracker contains no work items");
const ids = new Set();
for (const [, id, status, row] of rows) {
  if (ids.has(id)) throw new Error(`Duplicate progress ID: ${id}`);
  ids.add(id);
  if (!allowed.has(status)) throw new Error(`Invalid status for ${id}: ${status}`);
  const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((match) => match[1].replace(/<[^>]+>/g, "").trim());
  if (status === "done" && (!cells[3] || /^(?:None|Pending|Not yet|No implementation)$/i.test(cells[3])))
    throw new Error(`Completed item ${id} lacks acceptable evidence`);
}
console.log(`Progress tracker valid: ${rows.length} unique items`);
