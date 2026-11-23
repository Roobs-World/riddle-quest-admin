import targets from "./release-targets.json" with {type: "json"};
import {readFileSync} from "node:fs";
const definitions = targets.map(target => JSON.parse(readFileSync(new URL(`../../platforms/web/${target}/release.json`, import.meta.url), "utf8")));
/** Common packages are declarations, distinct from build/test dependencies. */
const sharedRuntimePackages = ["react", "react-dom", "scheduler", "three", "zod", "@babel/runtime"];
/** Packages permitted only in Firebase-backed provider adapters. */
const firebaseRuntimePackages = ["firebase", "@firebase/*", "@sentry/browser", "@sentry/core", "@sentry/browser-utils", "@sentry/conventions", "@sentry/feedback", "@sentry/replay", "@sentry/replay-canvas", "web-vitals", "idb", "tslib"];
const providerRuntimePackages = {jest: [...firebaseRuntimePackages, "html2canvas-pro"], facebook: firebaseRuntimePackages, reddit: ["@devvit/*", "valibot", "jwt-decode"]};
/** Canonical build facts consumed by Vite, dependency enforcement and release evidence. */
export const webBuildFacts = Object.freeze(Object.fromEntries(
  ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"].map(target => [target,
    Object.freeze({outputDirectory: `../../builds/${target}`, runtimePackages: Object.freeze([...sharedRuntimePackages, ...(providerRuntimePackages[target] ?? [])])})]),
));
// Canonical release facts consumed by commands, CI, packaging and release evidence.


/** Validates and freezes target facts; adding a neutral destination adds no game implementation. */
export function createReleaseRegistry(plans, html5 = {}) {
  const targets = new Set();
  return Object.freeze(plans.map(plan => {
    if (!/^[a-z][a-z0-9-]*$/.test(plan.target) || targets.has(plan.target)) throw new Error(`Invalid or duplicate target: ${plan.target}`);
    if (!plan.displayName) throw new Error(`Missing display name: ${plan.target}`);
    targets.add(plan.target);
    const neutral = html5[plan.target];
    return Object.freeze({...plan,
      ...(webBuildFacts[plan.target] ? {build: webBuildFacts[plan.target]} : {}),
      command: Object.freeze({...plan.command, args: Object.freeze([...plan.command.args])}),
      delivery: neutral ? 'neutral-html5' : plan.delivery ?? 'web-target',
      ...(neutral ? {artifact: neutral.artifact, releaseGate: neutral.boundary} : {}),
    });
  }));
}
export const releaseRegistry = createReleaseRegistry(definitions);
export function getReleaseDefinition(target) {
  const definition = releaseRegistry.find(row => row.target === target);
  if (!definition) throw new Error(`Unknown release target ${JSON.stringify(target)}; run pnpm release:plan for supported targets`);
  return definition;
}
