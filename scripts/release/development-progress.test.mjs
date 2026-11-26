import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {recordDevelopmentCompletion, validateDevelopmentCompletion} from './development-progress.mjs';
const revision = 'a'.repeat(40);
const receipt = {taskId: 'isolate-jest-itch', revision, targets: ['jest','itch'], work: 'Verify isolated handoffs',
  requiredChecks: ['build','browser'], checks: [{id:'build',status:'passed',evidence:'isolated build audit'}, {id:'browser',status:'passed',evidence:'play/save/reload'}],
  completedAt:'2026-09-29T12:00:00Z', remainingGates:['Manual provider review'], nextAction:'Upload reviewed handoff.'};
test('stale, incomplete, failed and duplicate verification cannot claim completion', () => {
  assert.equal(validateDevelopmentCompletion(receipt, {acceptedRevision:revision}), receipt);
  assert.throws(()=>validateDevelopmentCompletion(receipt, {acceptedRevision:'b'.repeat(40)}), /Stale/u);
  assert.throws(()=>validateDevelopmentCompletion({...receipt,sourceDigest:'invalid'}, {acceptedRevision:revision}), /source digest/u);
  assert.throws(()=>validateDevelopmentCompletion({...receipt,targets:['nowhere']}, {acceptedRevision:revision}), /target/u);
  for (const checks of [[], [receipt.checks[0]], [{...receipt.checks[0],status:'failed'}, receipt.checks[1]], [receipt.checks[0],receipt.checks[0]]]) {
    assert.throws(()=>validateDevelopmentCompletion({...receipt,checks},{acceptedRevision:revision}), /required checks/u);
  }
});
test('records one receipt the portfolio sync can read, replays safely and refuses a conflicting claim', async t => {
  const root=await mkdtemp(path.join(tmpdir(),'development-progress-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const file=await recordDevelopmentCompletion(root,receipt,{acceptedRevision:revision});
  assert.equal(file, path.join(root,'artifacts/development-progress',`${receipt.taskId}-${revision}.json`));
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')), {completion: receipt});
  assert.equal(await recordDevelopmentCompletion(root,receipt,{acceptedRevision:revision}), file);
  await assert.rejects(recordDevelopmentCompletion(root,{...receipt,work:'different claim'},{acceptedRevision:revision}), /Conflicting completion replay/u);
});
