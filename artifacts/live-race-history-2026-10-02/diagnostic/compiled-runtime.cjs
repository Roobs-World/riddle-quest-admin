const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/live-race-history-20261002/functions';
const load = name => require(path.join(root, name));
assert.equal(typeof load('race/raceLiveHistory.js').listLiveRaceHistoryForUser, 'function');
assert.equal(typeof load('race/raceLiveCallables.js').listLiveRaceHistory.run, 'function');
assert.equal(typeof load('reddit/redditGameplayEndpoint.js').redditGameplay, 'function');
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', handlerInvocation: false}));
