import {readdir, readFile} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || arguments_.some(argument => argument !== "--jest-facebook")) {
  throw new Error("E2E coverage audit accepts only --jest-facebook or the default full scope.");
}
const jestFacebook = arguments_.includes("--jest-facebook");
// These native-only suites remain subject to the default full-platform audit.
const nativeIntegrationSuites = new Set([
  "platforms/native/android/server/__tests__/androidNotifications.it.test.ts",
  "platforms/native/android/server/__tests__/androidReferrals.it.test.ts",
  "platforms/native/android/server/__tests__/androidSubscriptionRegistry.it.test.ts",
  "platforms/native/android/server/__tests__/race/androidRace.it.test.ts",
]);

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

const portalPackage = JSON.parse(await readFile(path.join(root, "packages/web-game/package.json"), "utf8"));
const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const portalScripts = Object.values(portalPackage.scripts ?? {}).join("\n");
const rulesConfig = await readFile(path.join(root, "firebase-functions/jest.rules.config.js"), "utf8");
const workflow = await readFile(path.join(root, ".github/workflows/production-readiness.yml"), "utf8");

const browserSuites = await collect(path.join(root, "packages/web-game/src"), (name) =>
  name.endsWith(".jest-playwright.test.ts"),
);
const integrationSuites = await collect(path.join(root, "firebase-functions/src"), (name) =>
  name.endsWith(".it.test.ts"),
);

const missingBrowserSuites = browserSuites.filter((file) => !portalScripts.includes(path.basename(file)));
const selectedIntegrationSuites = integrationSuites.filter(file => !jestFacebook ||
  !nativeIntegrationSuites.has(path.relative(root, file).split(path.sep).join("/")));
const missingIntegrationSuites = selectedIntegrationSuites.filter((file) => !rulesConfig.includes(path.basename(file)));
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
if (!/^\s*- run: pnpm test:e2e(?::jest-facebook)?\s*$/mu.test(workflow)) {
  failures.push("Production readiness must invoke a canonical test:e2e interface.");
}
if (workflow.includes("pnpm test:e2e:jest-facebook")) {
  const scoped = String(rootPackage.scripts?.["test:e2e:jest-facebook"] ?? "");
  if (!scoped.includes("check:e2e-coverage") || !scoped.includes("test:race:rules") || !scoped.includes("@riddle-quest/portal test:e2e:jest-facebook")) {
    failures.push("Jest/Facebook E2E must retain coverage auditing, backend rules, and the scoped portal interface.");
  }
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
    `E2E coverage audit passed (${jestFacebook ? "Jest/Facebook" : "full"}): ${browserSuites.length} Playwright suites and ${selectedIntegrationSuites.length} emulator suites have canonical entry points.`,
  );
}
