#!/usr/bin/env node
import {createHtml5HandoffPreparation} from './html5-handoff-preparation.mjs';
import {getWebBuildPaths} from './release-registry.mjs';
const source = await createHtml5HandoffPreparation().prepare();
console.log(`Prepared shared source for named HTML5 platform handoffs: ${getWebBuildPaths('netflix').buildDirectory}/${source.artifact} (${source.sha256}).`);
