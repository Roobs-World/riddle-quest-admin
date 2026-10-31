import {createRequire} from "node:module";
import {readdir, readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

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

await check(root);
if (process.argv.includes("--built")) {
  const deployed = require("./lib/index.js");
  for (const [name, handler] of Object.entries(deployed)) {
    if ((handler.__endpoint?.minInstances ?? 0) !== 0) failures.push(`${name}: built function reserves warm instances.`);
  }
}
if (failures.length) throw new Error(failures.join("\n"));
console.log("Function capacity audit passed: no reserved warm instances.");
