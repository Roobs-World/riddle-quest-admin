import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";

const script = new URL("./assert-reddit-promotion-ready.mjs", import.meta.url);
const tracker = new URL("../docs/reddit-games-progress.html", import.meta.url);

test("promotion guard rejects current blockers and accepts only R6-06 remaining", async () => {
  assert.throws(() => execFileSync(process.execPath, [script.pathname, tracker.pathname], {stdio: "pipe"}),
    /Reddit promotion blocked/u);
  const directory = await mkdtemp(path.join(tmpdir(), "rq-reddit-promotion-"));
  try {
    const source = await readFile(tracker, "utf8");
    const ready = source.replace(/,"(?:Not Started|In Progress|Blocked)"\),$/gmu, ',"Complete"),')
      .replace(/t\("R6-06"(.*?),"Complete"\),$/mu, 't("R6-06"$1,"Blocked"),');
    const fixture = path.join(directory, "tracker.html");
    await writeFile(fixture, ready);
    assert.match(execFileSync(process.execPath, [script.pathname, fixture], {encoding: "utf8"}), /48\/49/u);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
