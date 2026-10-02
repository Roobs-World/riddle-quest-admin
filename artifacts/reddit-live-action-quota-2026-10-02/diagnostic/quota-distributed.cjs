const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {createHmac} = require('node:crypto');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const projectId = process.env.GCLOUD_PROJECT;
assert.match(projectId || '', /^demo-/);
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
const secret = 'local-distributed-quota-fixture-secret-at-least-32-characters';
const now = Date.UTC(2026, 9, 2, 12);
const app = initializeApp({projectId});
const db = getFirestore(app);
const {consumeRedditRequestQuota} = require('/home/craig-beswetherick/.cache/riddle-quest-review/reddit-live-quota-20261002/functions/reddit/redditEndpoints.js');
const keyFor = operation => `riddle-quest\0t2_distributed_local\0${operation}`;
async function worker(operation, requests) {
  const results = await Promise.all(Array.from({length: requests}, () => consumeRedditRequestQuota(keyFor(operation), secret, db, now)));
  console.log(JSON.stringify({accepted: results.filter(Boolean).length, refused: results.filter(value => !value).length}));
}
function startWorker(operation, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, 'worker', operation, String(requests)], {env: process.env});
    let stdout = '', stderr = '';
    child.stdout.on('data', value => {stdout += value;});
    child.stderr.on('data', value => {stderr += value;});
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(`Local quota worker exited ${code}: ${stderr}`));
      else {try {resolve(JSON.parse(stdout));} catch (error) {reject(error);}}
    });
  });
}
async function main() {
  if (process.argv[2] === 'worker') return worker(process.argv[3], Number(process.argv[4]));
  const report = [];
  for (const [operation, limit] of [['gameplay.presence.poll', 60], ['gameplay.race.live.update', 120], ['gameplay.race.live.update.command', 120]]) {
    const id = createHmac('sha256', secret).update('riddle-quest-reddit-rate-v1\0').update(keyFor(operation)).digest('hex');
    const ref = db.doc(`redditGatewayRateLimits/${id}`);
    await ref.delete();
    try {
      const results = await Promise.all([startWorker(operation, limit / 2 + 2), startWorker(operation, limit / 2 + 2)]);
      const accepted = results.reduce((sum, result) => sum + result.accepted, 0);
      const refused = results.reduce((sum, result) => sum + result.refused, 0);
      assert.equal(accepted, limit);
      assert.equal(refused, 4);
      assert.equal((await ref.get()).data().count, limit);
      report.push({operation, independentRuntimes: 2, accepted, refused});
    } finally {await ref.delete();}
  }
  console.log(JSON.stringify({node: process.version, distributedQuotas: report, providerRequests: 0}));
}
main().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => deleteApp(app));
