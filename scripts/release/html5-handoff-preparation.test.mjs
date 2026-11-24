import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {createHtml5HandoffPreparation, loadPreparedHtml5Source} from './html5-handoff-preparation.mjs';
import {packageHtml5Platform} from './package-html5-platform.mjs';
import {createReleaseRegistry, getWebBuildPaths, releaseRegistry} from './release-registry.mjs';
const execute = promisify(execFile);
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'html5-handoff-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  let builds = 0;
  const run = async (command, args, options) => {
    if (command === 'pnpm') {
      builds++;
      const dist = path.join(root, getWebBuildPaths('netflix').outputDirectory);
      await mkdir(dist, {recursive: true});
      await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>Local game</title>');
      return {stdout: ''};
    }
    if (command === 'git') return {stdout: 'a'.repeat(40)};
    return execute(command, args, options);
  };
  return {root, run, builds: () => builds};
}
test('one preparation creates many verified handoffs and supports a newly registered destination', async t => {
  const f = await fixture(t);
  const preparation = createHtml5HandoffPreparation(f);
  const itch = await packageHtml5Platform('itch', {...f, preparation});
  const second = await packageHtml5Platform('newgrounds', {...f, preparation});
  assert.equal(f.builds(), 1);
  assert.equal(itch.sha256, second.sha256);
  assert.match((await execute('unzip', ['-Z1', path.join(f.root, getWebBuildPaths('itch').buildDirectory, itch.artifact)])).stdout, /^index.html$/mu);
  const [added] = createReleaseRegistry([{target: 'test-store', title: 'Test Store', displayName: 'Test Store',
    command: {executable: 'node', args: []}}], {'test-store': {artifact: 'build-test-store.zip', boundary: 'Review remains manual.'}});
  assert.equal(added.delivery, 'neutral-html5');
  assert.equal(added.displayName, 'Test Store');
  assert.equal((await preparation.handoff(added)).sha256, itch.sha256);
  assert.equal(releaseRegistry.find(row => row.target === 'facebook').delivery, 'web-target');
});
test('single destination prepares fresh and changed source cannot be reused', async t => {
  const f = await fixture(t);
  await packageHtml5Platform('itch', f);
  await packageHtml5Platform('itch', f);
  assert.equal(f.builds(), 2);
  await loadPreparedHtml5Source(f);
  await writeFile(path.join(f.root, getWebBuildPaths('netflix').buildDirectory, 'build-html5.zip'), 'changed');
  await assert.rejects(loadPreparedHtml5Source(f), /stale or changed/u);
});
test('failed preparation removes stale evidence and never writes a destination receipt', async t => {
  const f = await fixture(t);
  const sourceDirectory = path.join(f.root, getWebBuildPaths('netflix').buildDirectory);
  await mkdir(sourceDirectory, {recursive: true});
  await writeFile(path.join(sourceDirectory, 'build-html5.zip.source.json'), '{}');
  const preparation = createHtml5HandoffPreparation({...f, run: async () => { throw new Error('build rejected'); }});
  await assert.rejects(packageHtml5Platform('itch', {...f, preparation}), /build rejected/u);
  await assert.rejects(preparation.prepare(), /build rejected/u);
  await assert.rejects(readFile(path.join(sourceDirectory, 'build-html5.zip.source.json')), {code: 'ENOENT'});
  await assert.rejects(readFile(path.join(f.root, getWebBuildPaths('itch').buildDirectory, 'build-itch.zip.manifest.json')), {code: 'ENOENT'});
});
