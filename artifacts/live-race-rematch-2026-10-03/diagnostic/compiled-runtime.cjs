const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/live-race-rematch-20261003/functions';
const load = name => require(path.join(root, name));
assert.equal(typeof load('race/raceLiveRematch.js').prepareLiveRaceRematch, 'function');
assert.equal(typeof load('race/raceLiveInvitation.js').getLiveRaceChallengeForUser, 'function');
assert.equal(typeof load('race/raceLiveCallables.js').joinLiveRace.run, 'function');
assert.equal(typeof load('reddit/redditGameplayEndpoint.js').redditGameplay, 'function');
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', handlerInvocation: false}));
