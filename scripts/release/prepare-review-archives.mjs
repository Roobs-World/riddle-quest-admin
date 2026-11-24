#!/usr/bin/env node
// Prepare local platform review handoffs. Provider transmission is a separate action.
import {createHtml5HandoffPreparation} from './html5-handoff-preparation.mjs';
import {getWebBuildPaths, releaseRegistry} from './release-registry.mjs';
const preparation = createHtml5HandoffPreparation();
const definitions = releaseRegistry.filter(row => row.delivery === 'neutral-html5');
for (const definition of definitions) {
  const manifest = await preparation.handoff(definition);
  console.log(`${manifest.platform}: ${getWebBuildPaths(manifest.platform).buildDirectory}/${manifest.artifact} ${manifest.sha256}`);
}
console.log(`Prepared ${definitions.length} local review archives; no provider transmission occurred.`);
