"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {createRequire, isBuiltin} = require("node:module");

const functionsRoot = path.resolve(__dirname, "../..");
const manifest = require("../../package.json");
const outputRoot = path.join(functionsRoot, "lib");
const runtimeFiles = [];
let modules = 0;
let references = 0;

/** Checks compiled dependencies without initializing Firebase or contacting services. */
function inspectDirectory(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["__tests__", "__mocks__", "scripts", "node_modules"].includes(entry.name)) {
        throw new Error(`Unexpected source-only directory in Functions output: ${filename}`);
      }
      inspectDirectory(filename);
    } else {
      runtimeFiles.push(filename);
      if (!entry.name.endsWith(".js")) continue;
      modules += 1;
      const resolve = createRequire(filename).resolve;
      for (const match of fs.readFileSync(filename, "utf8").matchAll(/\brequire\(["']([^"']+)["']\)/gu)) {
        references += 1;
        const specifier = match[1];
        const resolved = resolve(specifier);
        if (isBuiltin(resolved)) continue;
        if (specifier.startsWith(".")) {
          if (!resolved.startsWith(`${outputRoot}${path.sep}`)) {
            throw new Error(`Relative dependency leaves Functions output: ${filename} -> ${specifier}`);
          }
        } else {
          const dependency = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0];
          if (!Object.hasOwn(manifest.dependencies, dependency)) {
            throw new Error(`Undeclared Functions runtime dependency: ${dependency}`);
          }
        }
      }
    }
  }
}

if (!fs.existsSync(path.join(functionsRoot, manifest.main))) {
  throw new Error(`Missing Functions deployment entry: ${manifest.main}`);
}
/** Uses the same enumerator and ignore rules as the installed Firebase upload packager. */
async function inspectUploadFiles() {
  const {readdirRecursive} = require("firebase-tools/lib/fsAsync");
  const config = require("../../../firebase.json").functions;
  if (!Array.isArray(config.ignore)) throw new Error("Functions upload requires explicit archive ignore rules");
  const files = await readdirRecursive({
    path: functionsRoot,
    ignoreStrings: [...config.ignore, "firebase-debug.log", "firebase-debug.*.log", ".runtimeconfig.json"],
  });
  const uploadNames = new Set(files.map((file) => path.relative(functionsRoot, file.name).split(path.sep).join("/")));
  const expectFile = (filename) => {
    const name = path.relative(functionsRoot, filename).split(path.sep).join("/");
    if (!uploadNames.has(name)) throw new Error(`Functions upload omits required artifact: ${name}`);
  };
  for (const filename of runtimeFiles) expectFile(filename);
  expectFile(path.join(functionsRoot, "package.json"));
  expectFile(path.join(functionsRoot, "package-lock.json"));
  for (const name of uploadNames) {
    if (name === "package.json" || name === "package-lock.json") continue;
    if (!name.startsWith("lib/")) {
      throw new Error(`Source-only or local file enters Functions upload: ${name}`);
    }
  }
  return uploadNames.size;
}

inspectDirectory(outputRoot);
inspectUploadFiles().then((uploadFiles) => {
  console.log(`Functions deployment artifact audit passed (${modules} modules, ${references} dependency references, ${uploadFiles} upload files).`);
}).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
