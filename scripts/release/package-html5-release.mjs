#!/usr/bin/env node
import {createHtml5HandoffPreparation} from './html5-handoff-preparation.mjs';
const source = await createHtml5HandoffPreparation().prepare();
console.log(`Prepared provider-neutral HTML5 release ${source.artifact} (${source.sha256}).`);
