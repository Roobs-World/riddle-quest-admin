import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {applyTaskResolutions} from './task-resolutions.mjs';
async function fixture(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'task-resolutions-'));
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'source.js'), 'verified');
  const entry = {taskId: 'beehive:test', status: 'Complete', description: 'Resolved', nextAction: 'Monitor', verifiedAt: '2026-10-10T00:00:00Z', evidence: {checks: ['Tests passed'], files: [{file: 'source.js', sha256: createHash('sha256').update('verified').digest('hex')}]}};
  const save = entries => writeFile(path.join(root, 'docs/task-resolutions.json'), JSON.stringify({schemaVersion: 1, resolutions: entries}));
  const tasks = [{id: 'beehive:test', project: 'beehive', status: 'Pending', sources: []}];
  try { await fn({root, entry, save, tasks}); } finally { await rm(root, {recursive: true, force: true}); }
}
test('verified completions persist while source matches; edits invalidate the claim', async () => fixture(async ({root, entry, save, tasks}) => {
  await save([entry]);
  assert.deepEqual(await applyTaskResolutions(tasks, root), {records: 1, stale: 0});
  assert.equal(tasks[0].status, 'Complete');
  await writeFile(path.join(root, 'source.js'), 'changed');
  assert.deepEqual(await applyTaskResolutions(tasks, root), {records: 1, stale: 1});
  assert.equal(tasks[0].status, 'Verification pending');
}));
test('unknown IDs, duplicate claims and traversal are rejected', async () => fixture(async ({root, entry, save, tasks}) => {
  await save([{...entry, taskId: 'unknown'}]);
  await assert.rejects(applyTaskResolutions(tasks, root), /Unknown/);
  await save([entry, entry]);
  await assert.rejects(applyTaskResolutions(tasks, root), /duplicate/);
  entry.evidence.files[0].file = '../secret';
  await save([entry]);
  await assert.rejects(applyTaskResolutions(tasks, root), /Invalid resolution file/);
}));

test('local verification remains local and becomes pending when its source changes', async () => fixture(async ({root, entry, save, tasks}) => {
  entry.status = 'Locally verified';
  entry.nextAction = 'Complete physical Safari and client LMS acceptance';
  await save([entry]);
  assert.deepEqual(await applyTaskResolutions(tasks, root), {records: 1, stale: 0});
  assert.equal(tasks[0].status, 'Locally verified');
  assert.equal(tasks[0].nextAction, 'Complete physical Safari and client LMS acceptance');
  await writeFile(path.join(root, 'source.js'), 'changed');
  assert.deepEqual(await applyTaskResolutions(tasks, root), {records: 1, stale: 1});
  assert.equal(tasks[0].status, 'Verification pending');
}));
