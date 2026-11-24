import {readFileSync, realpathSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const config = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const patchPath = /^ {2}braces@3\.0\.3: (\S+)$/mu.exec(config)?.[1];
if (!patchPath || !/GHSA-vfj7-8cjw-p6xm/u.test(config)) {
  throw new Error("The braces advisory exception requires its declared dependency patch.");
}
const patch = readFileSync(join(root, patchPath), "utf8");
for (const file of ["parse", "compile", "expand", "stringify", "constants"]) {
  if (!patch.includes(`diff --git a/lib/${file}.js`)) {
    throw new Error(`The braces security patch must cover lib/${file}.js.`);
  }
}
const devvit = realpathSync(join(root, "platforms/web/reddit/node_modules/devvit"));
const cli = createRequire(join(dirname(devvit), "@devvit/cli/package.json"));
const bracesEntry = createRequire(cli.resolve("chokidar")).resolve("braces");
if (!/braces@3\.0\.3_patch_hash=/u.test(realpathSync(bracesEntry))) {
  throw new Error("The Reddit CLI must resolve the patched braces dependency.");
}
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!/^pnpm check:braces-security && pnpm audit/u.test(manifest.scripts["verify:production"] ?? "")) {
  throw new Error("Production verification must audit the installed braces patch before dependency advisories.");
}
console.log("Braces security configuration and installed patch audit passed.");
