import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {applyDevelopmentCompletion, dashboardId, publishDevelopmentCompletion, recordDevelopmentCompletion} from './development-progress.mjs';
const revision = 'a'.repeat(40);
const receipt = {taskId: 'isolate-facebook-itch', revision, targets: ['facebook','itch'], work: 'Verify isolated handoffs',
  requiredChecks: ['build','browser'], checks: [{id:'build',status:'passed',evidence:'isolated build audit'}, {id:'browser',status:'passed',evidence:'play/save/reload'}],
  completedAt:'2026-09-29T12:00:00Z', remainingGates:['Manual provider review'], nextAction:'Upload reviewed handoff.'};
const snapshot = {id: dashboardId, queries: {provider_release_evidence:{rows:[{platform:'Facebook',state:'Testing',verifiedAt:'2026-09-22'}]}, submission_activity:{rows:[{platform:'itch.io',status:'Not submitted'}]}, backend_deployment_metrics:{rows:[{requests:10}]}}};
test('verified Facebook/itch completion creates reviewed rows and preserves external status', () => {
  const updated = applyDevelopmentCompletion(snapshot, receipt, {acceptedRevision:revision});
  assert.deepEqual(updated.queries.provider_release_evidence, snapshot.queries.provider_release_evidence);
  assert.deepEqual(updated.queries.submission_activity, snapshot.queries.submission_activity);
  assert.deepEqual(updated.queries.development_progress.rows.map(row=>row.platform), ['Facebook','itch.io']);
  assert.equal(applyDevelopmentCompletion(updated, receipt, {acceptedRevision:revision}), updated);
  assert.throws(()=>applyDevelopmentCompletion(updated, {...receipt, work:'different claim'}, {acceptedRevision:revision}), /Conflicting replay|Conflicting completion replay/u);
});
test('stale, incomplete, failed and duplicate verification cannot claim completion', () => {
  assert.throws(()=>applyDevelopmentCompletion(snapshot, receipt, {acceptedRevision:'b'.repeat(40)}), /Stale/u);
  assert.throws(()=>applyDevelopmentCompletion(snapshot, {...receipt,sourceDigest:'invalid'}, {acceptedRevision:revision}), /source digest/u);
  for (const checks of [[], [receipt.checks[0]], [{...receipt.checks[0],status:'failed'}, receipt.checks[1]], [receipt.checks[0],receipt.checks[0]]]) {
    assert.throws(()=>applyDevelopmentCompletion(snapshot,{...receipt,checks},{acceptedRevision:revision}), /required checks/u);
  }
});
test('publication replays safely and retries conflicts against current accepted head', async () => {
  let stored = snapshot, writes = 0;
  const store = {read:async()=>({data:stored,generation:String(writes)}),write:async(_name,data)=>{
    if (++writes === 1) {stored={...snapshot,queries:{...snapshot.queries,backend_deployment_metrics:{rows:[{requests:99}]}}};throw Object.assign(new Error('conflict'),{status:412});}
    stored=data;
  }};
  await publishDevelopmentCompletion(store, receipt, {getAcceptedRevision:async()=>revision});
  assert.equal(stored.queries.backend_deployment_metrics.rows[0].requests,99);
  assert.equal(writes,2);
  await publishDevelopmentCompletion(store, receipt, {getAcceptedRevision:async()=>revision});
  assert.equal(writes,2);
  await assert.rejects(publishDevelopmentCompletion(store, {...receipt,taskId:'other'}, {getAcceptedRevision:async()=>'b'.repeat(40)}), /Stale/u);
});
test('refresh failure remains durable, visible and retryable without losing local evidence', async t => {
  const root=await mkdtemp(path.join(tmpdir(),'development-progress-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const dir=path.join(root,'docs/reports/platform-release-readiness/src');await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'data.json'),JSON.stringify(snapshot));
  await assert.rejects(recordDevelopmentCompletion(root,receipt,{acceptedRevision:revision,publish:async()=>{throw new Error('refresh unavailable');}}),/unavailable/u);
  const file=path.join(root,'artifacts/development-progress',`${receipt.taskId}-${revision}.json`);
  assert.equal(JSON.parse(await readFile(file,'utf8')).sync,'failed');
  await recordDevelopmentCompletion(root,receipt,{acceptedRevision:revision,publish:async()=>{}});
  assert.equal(JSON.parse(await readFile(file,'utf8')).sync,'published');
  assert.equal(JSON.parse(await readFile(path.join(dir,'data.json'),'utf8')).queries.development_progress.rows.length,2);
});
