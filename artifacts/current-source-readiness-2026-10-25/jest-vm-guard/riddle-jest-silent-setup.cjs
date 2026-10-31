'use strict';
const {createRequire}=require('node:module');
const nativeRequire=createRequire('/tmp/riddle-jest-silent-setup.cjs');
const guard=nativeRequire(process.env.RIDDLE_SILENT_GUARD_MODULE||'/tmp/riddle-silent-browser.cjs');
const api=require('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/node_modules/@playwright/test');
guard.patchAPI(api);
if(!guard.isGuardedBrowserType(api.chromium))throw new Error('Jest VM Chromium guard was not installed');
process.stderr.write('[riddle-silent-guard] Jest VM Playwright API patched before test modules\n');
