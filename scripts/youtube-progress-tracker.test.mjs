import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {validateYouTubeProgressTracker} from "./validate-youtube-playables-progress.mjs";

const trackerUrl = new URL("../docs/youtube-playables-progress.html", import.meta.url);

test("accepts the tracked YouTube delivery contract", async () => {
  const source = await readFile(trackerUrl, "utf8");
  const result = validateYouTubeProgressTracker(source);
  assert.deepEqual(result.errors, []);
  assert.equal(result.tasks.length, 41);
});

test("rejects false completion evidence and blockers without reasons", async () => {
  const source = await readFile(trackerUrl, "utf8");
  const falseCompletion = source.replace(
    '"docs/youtube-playables-progress.html created with 41 validated task rows; pnpm check:youtube-progress passed 2026-08-20","","Complete"',
    '"TODO: prove it","","Complete"',
  );
  assert.ok(validateYouTubeProgressTracker(falseCompletion).errors.some((error) => error.includes("completed evidence")));

  const missingBlocker = source.replace(
    '"2026-08-20 MCP registry probe: only Expo, OpenAI developer-docs, and Unity servers are configured; no browser or YouTube Portal connector is available","Requires YouTube invitation and channel permissions plus a connected browser/Portal-capable MCP if this is to be continued through MCP.","Blocked"',
    '"2026-08-20 MCP registry probe: only Expo, OpenAI developer-docs, and Unity servers are configured; no browser or YouTube Portal connector is available","","Blocked"',
  );
  assert.ok(validateYouTubeProgressTracker(missingBlocker).errors.some((error) => error.includes("concrete blocker")));
});

test("rejects missing IDs and unsupported status values", async () => {
  const source = await readFile(trackerUrl, "utf8");
  const missingTask = source.replace(/^\s*t\("Y6-05".*\n/m, "");
  assert.ok(validateYouTubeProgressTracker(missingTask).errors.some((error) => error.includes("missing task Y6-05")));

  const unsupportedStatus = source.replace(
    '"docs/youtube-playables-progress.html created with 41 validated task rows; pnpm check:youtube-progress passed 2026-08-20","","Complete"',
    '"docs/youtube-playables-progress.html created with 41 validated task rows; pnpm check:youtube-progress passed 2026-08-20","","Waiting"',
  );
  assert.ok(validateYouTubeProgressTracker(unsupportedStatus).errors.some((error) => error.includes("unsupported status")));
});
