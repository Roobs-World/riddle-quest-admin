const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/live-race-safety-20261002/functions';
const load = name => require(path.join(root, name));
assert.equal(typeof load('social/liveRaceSafetyTarget.js').resolveLiveRaceSafetyTarget, 'function');
assert.equal(typeof load('social/socialSafetyCallables.js').blockRival.run, 'function');
assert.equal(typeof load('social/socialSafetyCallables.js').reportRival.run, 'function');
assert.equal(typeof load('reddit/redditGameplayEndpoint.js').redditGameplay, 'function');
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', handlerInvocation: false}));
