#!/usr/bin/env node
import {getReleaseDefinition, getWebBuildPaths, releaseRegistry} from "./release-registry.mjs";
import {createHtml5HandoffPreparation, loadPreparedHtml5Source, copyPreparedHtml5Handoff} from "./html5-handoff-preparation.mjs";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));

export function listHtml5DistributionDefinitions() {
  return releaseRegistry.filter(row => row.delivery === "neutral-html5").map(({target, artifact, releaseGate}) => ({target, artifact, boundary: releaseGate}));
}

export function getHtml5DistributionDefinition(target) {
  const definition = releaseRegistry.find(row => row.target === target);
  if (!definition || definition.delivery !== "neutral-html5") throw new Error(`Unknown HTML5 distribution target ${JSON.stringify(target)}`);
  return {artifact: definition.artifact, boundary: definition.releaseGate};
}

export async function packageHtml5Platform(target, {run = execute, root = repository, preparation, source} = {}) {
  getHtml5DistributionDefinition(target);
  const prepared = source ?? (process.env.HTML5_SOURCE_PREPARED === "1"
    ? await loadPreparedHtml5Source({root, run})
    : await (preparation ?? createHtml5HandoffPreparation({root, run})).prepare());
  const manifest = await copyPreparedHtml5Handoff(getReleaseDefinition(target), prepared, {root});
  console.log(`Prepared ${target} HTML5 handoff ${path.join(getWebBuildPaths(target).buildDirectory, manifest.artifact)} (${manifest.sha256}).`);
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  packageHtml5Platform(process.argv[2]).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
