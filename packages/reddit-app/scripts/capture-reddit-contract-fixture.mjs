#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {createRedditContractFixture, sourceDigest} from "./reddit-contract-fixture.mjs";

const [type, inputPath] = process.argv.slice(2);
if (!type || !inputPath) {
  throw new Error("usage: capture-reddit-contract-fixture.mjs <type> <raw-json-path|->");
}
const raw = await readFile(inputPath === "-" ? 0 : inputPath);
let payload;
try { payload = JSON.parse(raw); } catch { throw new Error("invalid-reddit-fixture-json"); }
const fixture = createRedditContractFixture({
  type,
  payload,
  capturedAt: new Date().toISOString(),
  sourceSha256: sourceDigest(raw),
});
process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`);
