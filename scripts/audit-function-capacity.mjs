import {createRequire} from "node:module";
import {readdir, readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const require = createRequire(new URL("../firebase-functions/package.json", import.meta.url));
const ts = require("typescript");
const root = new URL("../firebase-functions/src/", import.meta.url);
const failures = [];

async function check(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.name.startsWith("__")) continue;
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await check(url);
    else if (entry.name.endsWith(".ts")) {
      const source = ts.createSourceFile(fileURLToPath(url), await readFile(url, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node))
          && node.name.getText(source).replace(/["']/g, "") === "minInstances"
          && !(ts.isPropertyAssignment(node) && ts.isNumericLiteral(node.initializer) && node.initializer.text === "0")) {
          failures.push(`${source.fileName}: minInstances must be the literal 0.`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}

/** Checks the serialized SDK manifest that the deployment CLI receives. */
export function builtFunctionCapacityFailures(functions) {
  const failures = [];
  for (const [name, handler] of Object.entries(functions)) {
    if (!handler.__endpoint) continue;
    const endpoint = JSON.parse(JSON.stringify(handler.__endpoint));
    if (endpoint.minInstances !== 0) failures.push(`${name}: built function must explicitly set zero warm instances.`);
    if (Object.hasOwn(endpoint, "maxInstances") && endpoint.maxInstances === null) {
      failures.push(`${name}: built function resets externally managed maximum instances.`);
    }
  }
  return failures;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await check(root);
  if (process.argv.includes("--built")) failures.push(...builtFunctionCapacityFailures(require("./lib/index.js")));
  if (failures.length) throw new Error(failures.join("\n"));
  console.log("Function capacity audit passed: explicit zero warm instances and no maximum-instance resets.");
}
