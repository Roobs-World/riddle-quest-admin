const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/facebook-live-contexts-20261002/functions';
const load = name => require(path.join(root, name));
assert.equal(typeof load('race/facebookContextBoard.js').recordFacebookContextBoardRun, 'function');
assert.equal(typeof load('race/facebookLiveTournament.js').readFacebookLiveTournamentRun, 'function');
assert.equal(typeof load('race/redditTournament.js').recordRedditTournamentRun, 'function');
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', networkRequests: 0}));
