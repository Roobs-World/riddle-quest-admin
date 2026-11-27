#!/usr/bin/env node
import {createHtml5HandoffPreparation} from './html5-handoff-preparation.mjs';
import {releaseRegistry} from './release-registry.mjs';
import {packageHtml5Platform} from './package-html5-platform.mjs';
const source = await createHtml5HandoffPreparation().prepare();
for (const definition of releaseRegistry) {
  if (definition.delivery === 'neutral-html5') await packageHtml5Platform(definition.target, {source});
}
