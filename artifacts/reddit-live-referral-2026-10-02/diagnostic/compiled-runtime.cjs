const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/reddit-live-referral-20261002/functions';
const facebook = require(root + '/facebook/facebookLiveRaceReferralDelivery.js');
const reddit = require(root + '/reddit/redditLiveRaceReferralDelivery.js');
const uid = 'facebook_' + 'a'.repeat(40), ticket = 'b'.repeat(64);
const facebookId = facebook.facebookLiveRaceReferralEventId(uid, ticket);
assert.equal(facebookId, createHash('sha256').update('riddle-quest\0facebook-live-referral\0' + uid + '\0' + ticket).digest('hex'));
assert.notEqual(facebookId, reddit.redditLiveRaceReferralEventId(uid, ticket));
assert.notEqual(reddit.redditLiveRaceReferralEventId(uid, ticket), require(root + '/race/raceSetupService.js').requestDocumentId(uid, 'reddit-live-referral:' + ticket));
for (const fn of [facebook.validateFacebookLiveRaceReferralSource, reddit.validateRedditLiveRaceReferralSource,
  reddit.finishRedditLiveRaceReferralDelivery, require(root + '/race/raceLiveService.js').updateLiveRaceForUser,
  require(root + '/race/racePerformanceDelivery.js').deliverRacePerformance, require(root + '/race/raceDeliveryRecovery.js').replayRaceDelivery]) assert.equal(typeof fn, 'function');
process.stdout.write('Node ' + process.versions.node + ': compiled provider modules load; Facebook hash unchanged; Reddit, Facebook and legacy request domains remain distinct. No provider request issued.\n');
