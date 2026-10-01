#!/usr/bin/env node
import {createHtml5HandoffPreparation} from './html5-handoff-preparation.mjs';
const source = await createHtml5HandoffPreparation().prepare();
console.log(`Prepared shared source for named HTML5 platform handoffs: ${source.artifact} (${source.sha256}).`);
