import {readdir, readFile} from "node:fs/promises";
import path from "node:path";

import {measureSourceSize} from "./source-size-metric.mjs";

const root = process.cwd();
const scanRoots = [
  "packages/core/src",
  "packages/solo/src",
  "packages/android/src",
  "packages/portal/src",
  "packages/reddit-app/src",
  "firebase-functions/src",
  "scripts",
];
const ignoredSegments = new Set(["__mocks__", "coverage", "dist", "dist-jest", "lib", "node_modules"]);
const sourceExtensions = new Set([".css", ".js", ".mjs", ".ts", ".tsx"]);

const isTestFile = (file) =>
  file.includes(`${path.sep}__tests__${path.sep}`) || /\.(?:it\.)?test\.[cm]?[jt]sx?$/.test(file);

const maximumLines = (file) => {
  if (path.extname(file) === ".css") return 1_000;
  if (isTestFile(file)) return 1_200;
  // Stateful React coordinators need a little more room than leaf modules,
  // while still preventing the multi-thousand-line components this guard replaces.
  if (path.extname(file) === ".tsx") return 600;
  return 500;
};

async function collect(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredSegments.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const files = (await Promise.all(scanRoots.map((directory) => collect(path.join(root, directory))))).flat();
const violations = [];
for (const file of files) {
  const contents = await readFile(file, "utf8");
  const lines = measureSourceSize(contents, path.extname(file));
  const limit = maximumLines(file);
  if (lines > limit) violations.push({file: path.relative(root, file), lines, limit});
}

if (violations.length > 0) {
  console.error("Maintainable-file size audit failed:");
  for (const violation of violations.sort((left, right) => right.lines - left.lines)) {
    console.error(`- ${violation.file}: ${violation.lines} equivalent lines (limit ${violation.limit})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Maintainable-file size audit passed: ${files.length} source files within enforced limits.`);
}
