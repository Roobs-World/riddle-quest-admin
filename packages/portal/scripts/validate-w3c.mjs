import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {statSync} from "node:fs";
import path from "node:path";

// Resolve the pinned bundled checker from the caller's immutable portal package,
// including when this script is copied into the trusted release-script snapshot.
const requireFromPackage = createRequire(path.join(process.cwd(), "package.json"));
const checkerPackage = path.dirname(requireFromPackage.resolve("vnu-jar/package.json"));
const documents = process.argv.slice(2);
const documentPaths = (documents.length ? documents : ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo"]
  .flatMap(target => (target === "reddit" ? ["index.html", "reddit-inline.html"] : ["index.html"])
    .map(document => `../../builds/${target}/${document}`))).map(document => path.resolve(process.cwd(), document));
// Nu can silently skip nonexistent inputs; require every requested artifact first.
for (const document of documentPaths) {
  if (!statSync(document).isFile()) throw new Error(`W3C validation requires a document file: ${document}`);
}
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";
const validation = spawnSync(java, [
  "-jar", path.join(checkerPackage, "build", "dist", "vnu.jar"),
  "--format", "json", ...documentPaths,
], {encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024});
if (validation.error) throw new Error("The pinned Nu HTML checker could not run", {cause: validation.error});

// Nu writes its JSON diagnostic report to stderr, including for a successful check.
const report = validation.stdout.trim() || validation.stderr.trim();
let result;
try {
  result = JSON.parse(report);
} catch {
  throw new Error("The pinned Nu HTML checker did not return a valid diagnostic report");
}
if (!Array.isArray(result.messages)) throw new Error("The pinned Nu HTML checker report has no messages array");
if (result.messages.length > 0) {
  const details = result.messages.map(message => {
    const location = message.lastLine ? `line ${message.lastLine}` : "unknown location";
    return `${message.type ?? "message"} in ${message.url ?? "document"} at ${location}: ${message.message ?? "Unknown validation finding"}`;
  });
  throw new Error(`W3C HTML validation reported ${result.messages.length} finding(s):\n${details.join("\n")}`);
}
if (validation.status !== 0) throw new Error("The pinned Nu HTML checker failed without diagnostic findings");
console.log(`W3C HTML validation passed with zero findings (pinned Nu ${result.version}):\n${documentPaths.join("\n")}`);
