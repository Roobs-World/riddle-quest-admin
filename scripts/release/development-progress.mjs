import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {releaseRegistry} from './release-registry.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Completion changes development evidence only; provider states retain their own receipts. */
export function validateDevelopmentCompletion(completion, {acceptedRevision} = {}) {
  if (!/^[a-z0-9][a-z0-9:._-]{1,160}$/u.test(completion.taskId ?? '')) throw new Error('Invalid task ID');
  if (!/^[a-f0-9]{40}$/u.test(completion.revision ?? '') || completion.revision !== acceptedRevision) throw new Error('Stale or unaccepted revision');
  if (completion.sourceDigest !== undefined && !/^[a-f0-9]{64}$/u.test(completion.sourceDigest)) throw new Error('Invalid verified source digest');
  if (!completion.work?.trim() || !completion.nextAction?.trim() || !Array.isArray(completion.remainingGates)) throw new Error('Missing completed work or remaining gates');
  if (!Number.isFinite(Date.parse(completion.completedAt)) || Date.parse(completion.completedAt) > Date.now() + 60000) throw new Error('Invalid completion timestamp');
  if (!Array.isArray(completion.targets) || !completion.targets.length || new Set(completion.targets).size !== completion.targets.length ||
      completion.targets.some(target => !releaseRegistry.some(row => row.target === target))) throw new Error('Unknown or duplicate target ID');
  if (!Array.isArray(completion.requiredChecks) || !completion.requiredChecks.length || new Set(completion.requiredChecks).size !== completion.requiredChecks.length ||
      !Array.isArray(completion.checks) || completion.checks.length !== completion.requiredChecks.length ||
      completion.requiredChecks.some(id => completion.checks.filter(check => check.id === id && check.status === 'passed' && check.evidence?.trim()).length !== 1)) {
    throw new Error('Missing or failed required checks');
  }
  if ((completion.artifacts ?? []).some(artifact => !completion.targets.includes(artifact.target) || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? '') || !artifact.file)) throw new Error('Invalid artifact digest');
  return completion;
}

/**
 * Writes one validated completion receipt under `artifacts/development-progress`.
 *
 * The portfolio operations sync reads each receipt's `completion`. A replay of the same
 * completion is a no-op; a different claim for the same task and revision is refused.
 */
export async function recordDevelopmentCompletion(root, completion, {acceptedRevision} = {}) {
  validateDevelopmentCompletion(completion, {acceptedRevision});
  const directory = path.join(root, 'artifacts/development-progress');
  await mkdir(directory, {recursive: true});
  const receiptPath = path.join(directory, `${completion.taskId.replaceAll(':', '_')}-${completion.revision}.json`);
  const existing = await readFile(receiptPath, 'utf8').then(text => JSON.parse(text), error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing?.completion) {
    if (digest(existing.completion) !== digest(completion)) throw new Error('Conflicting completion replay');
    return receiptPath;
  }
  await writeFile(receiptPath, JSON.stringify({completion}, null, 2) + '\n');
  return receiptPath;
}
