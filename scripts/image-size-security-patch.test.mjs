import assert from "node:assert/strict";
import {readFileSync, realpathSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const workspaceConfig = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
const patchPath = join(repositoryRoot, "patches/image-size@2.0.2.patch");
const patch = readFileSync(patchPath, "utf8");

test("the image-size audit exceptions stay bound to the reviewed patch", () => {
  assert.match(workspaceConfig, /image-size@2\.0\.2: patches\/image-size@2\.0\.2\.patch/u);
  assert.match(workspaceConfig, /GHSA-5p2g-fcmc-qvqq/u);
  assert.match(workspaceConfig, /GHSA-w3rx-r6r6-pgpr/u);
  assert.match(patch, /Invalid HEIF, invalid ispe box size/u);
  assert.match(patch, /Invalid ICNS, invalid entry length/u);
  assert.match(patch, /Invalid JXL, invalid jxlp box size/u);
});

test("malformed HEIF, ICNS, and JXL inputs terminate without looping", () => {
  const devvitRoot = realpathSync(join(repositoryRoot, "packages/reddit-app/node_modules/devvit"));
  const cliPackage = join(dirname(devvitRoot), "@devvit/cli/package.json");
  const imageSizeEntry = createRequire(cliPackage).resolve("image-size");
  const prelude = String.raw`
    const assert = require("node:assert/strict");
    const {imageSize} = require(${JSON.stringify(imageSizeEntry)});

    const writeBox = (input, offset, size, name) => {
      input.writeUInt32BE(size, offset);
      input.write(name, offset + 4, 4, "ascii");
    };
  `;
  const cases = [
    ["ICNS", String.raw`
      const input = Buffer.alloc(16);
      input.write("icns", 0, 4, "ascii");
      input.writeUInt32BE(16, 4);
      input.write("ICON", 8, 4, "ascii");
      input.writeUInt32BE(0, 12);
    `],
    ["JXL", String.raw`
      const input = Buffer.alloc(32);
      writeBox(input, 0, 12, "JXL ");
      writeBox(input, 12, 12, "ftyp");
      input.write("jxl ", 20, 4, "ascii");
      writeBox(input, 24, 0, "jxlp");
    `],
    ["HEIF", String.raw`
      const input = Buffer.alloc(48);
      writeBox(input, 0, 12, "ftyp");
      input.write("heic", 8, 4, "ascii");
      writeBox(input, 12, 12, "meta");
      writeBox(input, 24, 8, "iprp");
      writeBox(input, 32, 16, "ipco");
      writeBox(input, 40, 0, "ispe");
    `],
  ];

  for (const [name, setup] of cases) {
    const result = spawnSync(process.execPath, ["-e", `${prelude}\n${setup}\nassert.throws(() => imageSize(input));`], {
      encoding: "utf8",
      timeout: 1_000,
    });
    assert.notEqual(result.error?.code, "ETIMEDOUT", `${name} parsing exceeded the safety timeout`);
    assert.equal(result.signal, null, `${name} security probe was terminated by ${result.signal}`);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
