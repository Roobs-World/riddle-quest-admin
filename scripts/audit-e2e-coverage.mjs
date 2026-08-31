import {readdir, readFile} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

/** Collects files below a directory that satisfy a predicate. */
async function collect(directory, predicate) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute, predicate)));
    else if (predicate(entry.name)) files.push(absolute);
  }
  return files;
}

const portalPackage = JSON.parse(await readFile(path.join(root, "packages/portal/package.json"), "utf8"));
const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const portalScripts = Object.values(portalPackage.scripts ?? {}).join("\n");
const rulesConfig = await readFile(path.join(root, "firebase-functions/jest.rules.config.js"), "utf8");
const workflow = await readFile(path.join(root, ".github/workflows/production-readiness.yml"), "utf8");

const browserSuites = await collect(path.join(root, "packages/portal/src"), (name) =>
  name.endsWith(".jest-playwright.test.ts"),
);
const integrationSuites = await collect(path.join(root, "firebase-functions/src"), (name) =>
  name.endsWith(".it.test.ts"),
);

const missingBrowserSuites = browserSuites.filter((file) => !portalScripts.includes(path.basename(file)));
const missingIntegrationSuites = integrationSuites.filter((file) => !rulesConfig.includes(path.basename(file)));
const failures = [];

if (missingBrowserSuites.length > 0) {
  failures.push(
    `Playwright suites missing from portal scripts: ${missingBrowserSuites.map((file) => path.relative(root, file)).join(", ")}`,
  );
}
if (missingIntegrationSuites.length > 0) {
  failures.push(
    `Emulator integration suites missing from jest.rules.config.js: ${missingIntegrationSuites.map((file) => path.relative(root, file)).join(", ")}`,
  );
}
if (!String(rootPackage.scripts?.["test:e2e"] ?? "").includes("test:e2e:local")) {
  failures.push("The root test:e2e interface must invoke the portal test:e2e:local interface.");
}
if (!workflow.includes("pnpm test:e2e")) {
  failures.push("Production readiness must invoke the canonical pnpm test:e2e interface.");
}
if (/pnpm .*test:(?:race:rules|[^\s]+:playwright|mobile-soak)/u.test(workflow)) {
  failures.push("Production readiness must not duplicate commands owned by the canonical test:e2e interface.");
}

if (failures.length > 0) {
  console.error("E2E coverage audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `E2E coverage audit passed: ${browserSuites.length} Playwright suites and ${integrationSuites.length} emulator suites are reachable through pnpm test:e2e.`,
  );
}
