const assert = require('node:assert/strict');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/live-deletion-20261002/functions';
const marker = require(root + '/race/raceLivePrivacy.js').DELETED_LIVE_RACE_USER_ID;
assert.equal(marker, 'deleted-live-player');
assert.equal(require(root + '/facebook/facebookSecurity.js').isFacebookFirebaseUid(marker), false);
for (const fn of [require(root + '/profile/accountDeletion/liveRaceAccountDeletion.js').removeLiveRaceIdentitySnapshots,
  require(root + '/profile/accountDeletion/raceAccountDeletion.js').removeCrossUserRaceIdentitySnapshots,
  require(root + '/race/facebookLiveTournament.js').readFacebookLiveTournamentRun,
  require(root + '/race/raceLiveService.js').updateLiveRaceForUser]) assert.equal(typeof fn, 'function');
process.stdout.write('Node ' + process.versions.node + ': compiled live privacy, deletion, gameplay and native score modules load; neutral marker is not a Facebook identity. No provider request issued.\n');
