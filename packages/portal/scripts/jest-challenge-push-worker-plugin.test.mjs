import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {jestChallengePushWorkerPlugin} from '../jestChallengePushWorkerPlugin.ts';
import {webTargetDependencyPlugin, targetDependencyEvidencePath} from '../webTargetDependencies.ts';

const id = 'virtual:jest-live-challenge-push-worker-url';
test('only the Jest target can resolve the notification worker', () => {
  for (const target of ['facebook', 'reddit', 'youtube', 'netflix', 'yahoo'])
    assert.throws(() => jestChallengePushWorkerPlugin(target, 'build').resolveId(id), /cannot emit the Jest notification worker/);
  const dev = jestChallengePushWorkerPlugin('jest', 'serve');
  assert.equal(dev.resolveId('unrelated'), null);
  assert.equal(dev.load('\0' + id), 'export default "/src/jest/notifications/liveChallengePushWorker.js";');
});
test('production emits a separate worker and includes its real source in dependency evidence', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'riddle-worker-build-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const entry = path.join(root, 'main.js');
  const source = fileURLToPath(new URL('../src/jest/notifications/liveChallengePushWorker.js', import.meta.url));
  await writeFile(entry, `import url from ${JSON.stringify(source + '?url')};console.log(url);`);
  const output = path.join(root, 'dist'), evidence = path.join(root, 'evidence');
  await build({root, configFile: false, publicDir: false, logLevel: 'silent',
    plugins: [jestChallengePushWorkerPlugin('jest', 'build'), webTargetDependencyPlugin('jest', {evidenceDirectory: evidence})],
    build: {outDir: output, rolldownOptions: {input: entry}}});
  const inventory = JSON.parse(await readFile(targetDependencyEvidencePath('jest', output, evidence), 'utf8'));
  assert.ok(inventory.modules.some(module => module.endsWith('/jest/notifications/liveChallengePushWorker.js')));
  const worker = inventory.chunks.find(chunk => /liveChallengePushWorker-/.test(chunk.file));
  assert.ok(worker?.entry, 'The worker is an inspected standalone script entry');
  assert.ok(inventory.files.some(file => file.file === worker.file));
  const main = inventory.chunks.find(chunk => chunk.file !== worker.file && chunk.entry);
  assert.match(await readFile(path.join(output, main.file), 'utf8'), /liveChallengePushWorker-/);
  assert.doesNotMatch(await readFile(path.join(output, main.file), 'utf8'), /data:(?:text|application)\/javascript/);
});
