import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, rm, symlink, unlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {developmentSourceDigest} from './development-source-digest.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'development-source-digest-'));
  const repository = path.join(root, 'repository');
  await mkdir(repository);
  execFileSync('git', ['init', '--quiet', repository]);
  try { await run(repository, root); }
  finally { await rm(root, {recursive: true, force: true}); }
}

test('binds tracked, untracked and deleted source while excluding derived evidence', async () => fixture(async repository => {
  const source = path.join(repository, 'source.txt');
  await writeFile(source, 'original');
  execFileSync('git', ['add', 'source.txt'], {cwd: repository});
  const original = await developmentSourceDigest(repository);
  await writeFile(source, 'changed');
  const changed = await developmentSourceDigest(repository);
  assert.notEqual(changed, original);
  await writeFile(path.join(repository, 'new-source.txt'), 'new');
  const added = await developmentSourceDigest(repository);
  assert.notEqual(added, changed);
  await mkdir(path.join(repository, 'artifacts'));
  await mkdir(path.join(repository, '.codex'));
  await mkdir(path.join(repository, 'docs/reports/platform-release-readiness/src'), {recursive: true});
  await writeFile(path.join(repository, 'artifacts/receipt.json'), 'derived');
  await writeFile(path.join(repository, '.codex/state.json'), 'private state');
  await writeFile(path.join(repository, 'docs/reports/platform-release-readiness/src/data.json'), 'ledger');
  assert.equal(await developmentSourceDigest(repository), added);
  await unlink(source);
  assert.notEqual(await developmentSourceDigest(repository), added);
}));

test('hashes link identity, tolerates missing targets and never follows external directories', async () => fixture(async (repository, root) => {
  const external = path.join(root, 'external');
  await mkdir(external);
  await writeFile(path.join(external, 'content.txt'), 'outside source');
  const link = path.join(repository, 'skill-link');
  await symlink(external, link);
  const original = await developmentSourceDigest(repository);
  await writeFile(path.join(external, 'content.txt'), 'outside changed');
  assert.equal(await developmentSourceDigest(repository), original);
  await unlink(link);
  await symlink(path.join(root, 'missing'), link);
  assert.notEqual(await developmentSourceDigest(repository), original);
}));

test('large excluded archive inventories cannot exhaust Git source output', async () => fixture(async repository => {
  await writeFile(path.join(repository, 'source.txt'), 'kept');
  const original = await developmentSourceDigest(repository);
  const archives = path.join(repository, 'artifacts');
  await mkdir(archives);
  for (let index = 0; index < 6000; index++) await writeFile(path.join(archives, `${index}-${'a'.repeat(180)}`), 'derived');
  assert.equal(await developmentSourceDigest(repository), original);
}));

test('dashboard synchronization leaves game evidence stable while API and authored code changes invalidate it', async () => fixture(async repository => {
  const report = path.join(repository, 'docs/reports/platform-release-readiness');
  await mkdir(path.join(report, 'src/content'), {recursive: true});
  await mkdir(path.join(report, 'api'));
  await writeFile(path.join(report, 'api/index.mjs'), 'export default handler;');
  const baseline = await developmentSourceDigest(repository);
  const register = path.join(report, 'src/content/task-register.json');
  await writeFile(register, JSON.stringify({generatedAt: 'first', tasks: []}));
  execFileSync('git', ['add', 'docs/reports/platform-release-readiness/src/content/task-register.json'], {cwd: repository});
  await writeFile(register, JSON.stringify({generatedAt: 'second', tasks: [{status: 'Verification pending'}]}));
  await writeFile(path.join(report, 'src/data.json'), JSON.stringify({generatedAt: 'second'}));
  assert.equal(await developmentSourceDigest(repository), baseline);
  await writeFile(path.join(report, 'api/index.mjs'), 'export default changedHandler;');
  const apiChanged = await developmentSourceDigest(repository);
  assert.notEqual(apiChanged, baseline);
  await writeFile(path.join(report, 'src/content/helper.js'), 'export const value = 1;');
  assert.notEqual(await developmentSourceDigest(repository), apiChanged);
}));
