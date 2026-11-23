import {existsSync, lstatSync, readdirSync, readFileSync} from "node:fs";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {webApplications, platformServerRoots} from "./platform-layout.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const read = name => JSON.parse(readFileSync(resolve(root, name), "utf8"));
for (const old of ["packages/portal", "packages/android", "packages/reddit-app"]) {
  if (existsSync(resolve(root, old))) failures.push(`Move platform sources out of ${old}.`);
}
for (const target of webApplications) {
  const base = `platforms/web/${target}`;
  for (const file of ["package.json", "index.html", "src/main.tsx", "release.json"]) {
    if (!existsSync(resolve(root, base, file))) failures.push(`Missing platform owner: ${base}/${file}`);
  }
  const manifest = read(`${base}/package.json`);
  if (["youtube", "netflix", "yahoo", "gamesnacks"].includes(target)) {
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (/^(?:firebase|@firebase\/|@sentry\/|@devvit\/)/u.test(name)) failures.push(`${base} declares forbidden provider dependency ${name}.`);
    }
  }
}
for (const base of platformServerRoots) {
  if (read(`${base}/package.json`).type !== "commonjs") failures.push(`${base} must preserve CommonJS server emission.`);
}
const targets = read("scripts/release/release-targets.json");
for (const target of targets) {
  if (read(`platforms/web/${target}/release.json`).target !== target) failures.push(`Release owner mismatch for ${target}.`);
}
const scope = path => relative(root, path).replaceAll("\\", "/").match(/^platforms\/(?:web|native)\/([^/]+)\//u)?.[1];
function inspect(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.name.startsWith(".") || ["node_modules", "__tests__", "test", "tests", "generated", "server"].includes(entry.name)) continue;
    const file = resolve(directory, entry.name);
    if (lstatSync(file).isSymbolicLink()) { failures.push(`Source ownership cannot use symlinks: ${relative(root, file)}`); continue; }
    if (entry.isDirectory()) { inspect(file); continue; }
    if (!/\.[cm]?[jt]sx?$/u.test(file) || /\.(?:test|spec)\./u.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](\.[^"']+)["']/gu)) {
      const target = resolve(dirname(file), match[1]);
      const owner = scope(file), imported = scope(target);
      if (imported && imported !== owner) failures.push(`${relative(root, file)} imports another platform: ${match[1]}`);
    }
  }
}
for (const directory of ["packages/core/src", "packages/solo/src", "packages/hosted/src", "packages/web-game/src", ...webApplications.map(target => `platforms/web/${target}/src`), "platforms/native/android/src"]) inspect(resolve(root, directory));
if (failures.length) throw new Error(failures.join("\n"));
console.log(`Platform layout passed: ${webApplications.length} web apps, ${targets.length} release owners and Android.`);
