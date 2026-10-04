const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/presence-visibility-ordering-20261003/functions';
for (const [file, names] of Object.entries({
  'presence/presenceVisibility.js': ['refreshPresenceVisibility', 'deletePresenceForUser', 'syncKnownRivalPresenceVisibility', 'syncBlockedRivalPresenceVisibility'],
  'social/socialSafety.js': ['blockKnownRival'],
  'jest/jestAccountDeletion.js': ['runWithJestAccountOperationLease'],
  'reddit/redditGameplayEndpoint.js': ['redditGameplay'],
})) {
  const loaded = require(path.join(root, file));
  for (const name of names) assert.equal(typeof loaded[name], 'function');
}
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', handlerInvocation: false}));
