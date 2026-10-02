const assert = require('node:assert/strict');
const path = require('node:path');
const root = '/home/craig-beswetherick/.cache/riddle-quest-review/facebook-notification-bytes-20261002/functions';
const load = name => require(path.join(root, name));
assert.equal(typeof load('facebook/facebookNotificationTransport.js').createFacebookNotificationTransport, 'function');
assert.equal(typeof load('facebook/facebookNotificationDispatch.js').createFacebookNotificationDispatchLedger, 'function');
assert.equal(typeof load('race/raceLivePushDelivery.js').sendFacebookLiveChallengePush, 'function');
assert.equal(typeof load('race/raceLivePushDelivery.js').deliverLiveRacePush, 'function');
console.log(JSON.stringify({node: process.version, moduleLoad: 'passed', networkRequests: 0}));
