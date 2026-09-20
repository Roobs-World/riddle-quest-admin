#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {readFile, rm, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const portal = path.join(repository, "packages/portal");
const archive = path.join(repository, "build-html5.zip");
const checksum = path.join(repository, "build-html5.sha256");

await execute("pnpm", ["--filter", "@qwordly/portal", "build:netflix"], {cwd: repository});
await rm(archive, {force: true});
await execute("zip", ["-q", "-r", archive, "."], {cwd: path.join(portal, "dist-netflix")});
const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(checksum, `${digest}  build-html5.zip\n`);
console.log(`Prepared provider-neutral HTML5 release ${path.basename(archive)} (${digest}).`);
