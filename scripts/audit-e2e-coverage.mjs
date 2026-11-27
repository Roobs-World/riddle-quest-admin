import {readdir, readFile} from "node:fs/promises";
import path from "node:path";
import {webApplications, platformServerRoots} from "./platform-layout.mjs";

const root = process.cwd();
const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || arguments_.some(argument => argument !== "--facebook")) {
  throw new Error("E2E coverage audit accepts only --facebook or the default full scope.");
}
const facebookOnly = arguments_.includes("--facebook");
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

const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const projectScripts = Object.values(rootPackage.scripts ?? {}).join("\n");
const serverPackage = JSON.parse(await readFile(path.join(root, "firebase-functions/package.json"), "utf8"));
const emulatorConfigurations = new Set(["config/testing/jest.rules.config.js"]);
for (const script of Object.values(serverPackage.scripts ?? {})) {
  if (!script.includes("emulators:exec")) continue;
  for (const match of script.matchAll(/--config\s+((?:config\/testing\/)?jest[\w.-]+\.config\.js)/gu)) emulatorConfigurations.add(match[1]);
}
const emulatorConfig = (await Promise.all([...emulatorConfigurations]
  .map(name => readFile(path.join(root, "firebase-functions", name), "utf8")))).join("\n");
const workflow = await readFile(path.join(root, ".github/workflows/production-readiness.yml"), "utf8");

const browserRoots = ["src", ...(facebookOnly ? ["facebook"] : webApplications)
  .map(target => `platforms/web/${target}/src`)];
const browserSuites = (await Promise.all(browserRoots.map(directory => collect(path.join(root, directory),
  name => name.endsWith(".jest-playwright.test.ts"))))).flat();
const integrationSuites = (await Promise.all(["firebase-functions/src", ...platformServerRoots]
  .map(directory => collect(path.join(root, directory), name => name.endsWith(".it.test.ts"))))).flat();

const missingBrowserSuites = browserSuites.filter((file) => !projectScripts.includes(path.basename(file)));
const selectedIntegrationSuites = integrationSuites.filter(file => !facebookOnly ||
  !nativeIntegrationSuites.has(path.relative(root, file).split(path.sep).join("/")));
const missingIntegrationSuites = selectedIntegrationSuites.filter((file) => !emulatorConfig.includes(path.basename(file)));
const failures = [];

if (missingBrowserSuites.length > 0) {
  failures.push(
    `Playwright suites missing from root scripts: ${missingBrowserSuites.map((file) => path.relative(root, file)).join(", ")}`,
  );
}
if (missingIntegrationSuites.length > 0) {
  failures.push(
    `Emulator integration suites missing from registered configurations: ${missingIntegrationSuites.map((file) => path.relative(root, file)).join(", ")}`,
  );
}
if (!String(rootPackage.scripts?.["test:e2e"] ?? "").includes("test:e2e:local")) {
  failures.push("The root test:e2e interface must invoke test:e2e:local.");
}
if (!/^\s*- run: pnpm test:e2e(?::facebook)?\s*$/mu.test(workflow)) {
  failures.push("Production readiness must invoke a canonical test:e2e interface.");
}
if (workflow.includes("pnpm test:e2e:facebook")) {
  const scoped = String(rootPackage.scripts?.["test:e2e:facebook"] ?? "");
  if (!scoped.includes("check:e2e-coverage") || !scoped.includes("test:race:rules") || !scoped.includes("pnpm test:e2e:facebook:web")) {
    failures.push("Facebook E2E must retain coverage auditing, backend rules, and the scoped browser interface.");
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
    `E2E coverage audit passed (${facebookOnly ? "Facebook" : "full"}): ${browserSuites.length} Playwright suites and ${selectedIntegrationSuites.length} emulator suites have canonical entry points.`,
  );
}
