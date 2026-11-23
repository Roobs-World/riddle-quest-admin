"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {createRequire, isBuiltin} = require("node:module");

const functionsRoot = path.resolve(__dirname, "..");
const manifest = require("../package.json");
const outputRoot = path.join(functionsRoot, "lib");
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
    } else if (entry.name.endsWith(".js")) {
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
inspectDirectory(outputRoot);
console.log(`Functions deployment artifact audit passed (${modules} modules, ${references} dependency references).`);
