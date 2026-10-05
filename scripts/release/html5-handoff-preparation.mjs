import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {copyFile, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const execute = promisify(execFile);
export const releaseRepository = fileURLToPath(new URL('../..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** One source lifecycle per run; failures remain failures rather than reusing stale bytes. */
export function createHtml5HandoffPreparation({root = releaseRepository, run = execute} = {}) {
  let preparation;
  const archive = path.join(root, 'build-html5.zip');
  const receipt = `${archive}.source.json`;
  async function prepare() {
    await Promise.all([archive, receipt, path.join(root, 'build-html5.sha256')].map(file => rm(file, {force: true})));
    await run('pnpm', ['--filter', '@qwordly/portal', 'build:netflix'], {cwd: root});
    await run('zip', ['-q', '-r', archive, '.'], {cwd: path.join(root, 'builds/netflix')});
    const {stdout: entries} = await run('unzip', ['-Z1', archive], {cwd: root});
    if (!entries.split('\n').includes('index.html') || entries.split('\n').some(entry =>
      entry.startsWith('/') || entry.split('/').includes('..') || entry.endsWith('.map'))) {
      throw new Error('Neutral source must have a root index and safe, source-map-free entries');
    }
    const {stdout: revision} = await run('git', ['rev-parse', 'HEAD'], {cwd: root});
    const source = {schemaVersion: 1, artifact: 'build-html5.zip', sha256: sha256(await readFile(archive)),
      revision: revision.trim(), preparedAt: new Date().toISOString()};
    await writeFile(path.join(root, 'build-html5.sha256'), `${source.sha256}  build-html5.zip\n`);
    await writeFile(receipt, JSON.stringify(source, null, 2) + '\n');
    return source;
  }
  return {
    prepare() { return preparation ??= prepare(); },
    async handoff(definition) {
      const source = await this.prepare();
      return copyPreparedHtml5Handoff(definition, source, {root});
    },
  };
}

/** Validates a receipt explicitly passed by this release run before sharing its source. */
export async function loadPreparedHtml5Source({root = releaseRepository, run = execute} = {}) {
  const source = JSON.parse(await readFile(path.join(root, 'build-html5.zip.source.json'), 'utf8'));
  const {stdout: revision} = await run('git', ['rev-parse', 'HEAD'], {cwd: root});
  if (source.schemaVersion !== 1 || source.artifact !== 'build-html5.zip' || source.revision !== revision.trim() ||
      source.sha256 !== sha256(await readFile(path.join(root, source.artifact)))) throw new Error('Prepared HTML5 source is stale or changed');
  return source;
}

/** Verifies source bytes on each copy and publishes the manifest only after the archive. */
export async function copyPreparedHtml5Handoff(definition, source, {root = releaseRepository} = {}) {
  if (source.artifact !== 'build-html5.zip' || !/^build-[a-z0-9-]+\.zip$/.test(definition.artifact)) throw new Error('Invalid handoff paths');
  const bytes = await readFile(path.join(root, source.artifact));
  if (sha256(bytes) !== source.sha256) throw new Error('Prepared HTML5 source changed');
  const artifact = path.join(root, definition.artifact);
  const temporary = `${artifact}.${process.pid}.tmp`;
  await rm(`${artifact}.manifest.json`, {force: true});
  try {
    await copyFile(path.join(root, source.artifact), temporary);
    if (sha256(await readFile(temporary)) !== source.sha256) throw new Error('HTML5 source changed during copy');
    await rename(temporary, artifact);
    const manifest = {schemaVersion: 1, platform: definition.target, artifact: definition.artifact, sha256: source.sha256,
      sourceArtifact: source.artifact, sourceRevision: source.revision, sourcePreparedAt: source.preparedAt,
      releaseBoundary: definition.releaseGate};
    await writeFile(`${artifact}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  } finally { await rm(temporary, {force: true}); }
}
