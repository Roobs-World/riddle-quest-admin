import {createHash} from 'node:crypto';
import {readFile, rename, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {releaseRegistry} from './release-registry.mjs';

export const dashboardId = '7677b77a-0b56-4194-a2e7-937aff8f27f7';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Completion changes development evidence only; provider states retain their own receipts. */
export function applyDevelopmentCompletion(snapshot, completion, {acceptedRevision} = {}) {
  if (snapshot.id !== dashboardId) throw new Error('Dashboard identity mismatch');
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
  const receiptDigest = digest(completion);
  const prior = snapshot.queries.development_progress?.rows ?? [];
  const replay = prior.filter(row => row.taskId === completion.taskId && row.revision === completion.revision);
  if (replay.length) {
    if (replay.some(row => row.receiptDigest !== receiptDigest)) throw new Error('Conflicting completion replay');
    return snapshot;
  }
  const rows = completion.targets.map(target => ({
    taskId: completion.taskId, target, platform: releaseRegistry.find(row => row.target === target).dashboardName,
    status: 'Development verified', work: completion.work, revision: completion.revision,
    sourceDigest: completion.sourceDigest ?? null, completedAt: completion.completedAt,
    checks: completion.checks.map(check => `${check.id}: ${check.evidence}`).join('; '),
    artifacts: (completion.artifacts ?? []).filter(artifact => artifact.target === target).map(artifact => `${artifact.file}: ${artifact.sha256}`).join('; ') || 'No artifact claim',
    remainingGates: completion.remainingGates.join('; ') || 'No additional development gate',
    nextAction: completion.nextAction, trigger: completion.trigger ?? 'local', receiptDigest,
  }));
  return {...snapshot, generatedAt: completion.completedAt, queries: {...snapshot.queries,
    development_progress: {rows: [...prior, ...rows], source: {
      label: 'Verified development task completion receipts', retrievedAt: completion.completedAt,
      tables: ['artifacts/development-progress/*.json', 'accepted revision verification checks'],
      filters: ['Development verification does not establish provider submission, approval or publication.',
        'Each receipt names the revision, required successful checks, remaining gates and any exact artifact digests.'],
      metricDefinitions: [{label: 'Development verified', definition: 'Required checks passed for the recorded CI revision, or the accepted base revision and exact working source digest. Provider receipts remain separate.', componentIds: ['development-progress']}],
    }},
  }};
}

/** Optimistic concurrency retries re-read measurements and prevent stale revision overwrites. */
export async function publishDevelopmentCompletion(store, completion, {getAcceptedRevision} = {}) {
  if (!getAcceptedRevision) throw new Error('Accepted revision lookup is required');
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await store.read('snapshot.json');
    if (!current) throw new Error('Existing dashboard snapshot is required');
    const acceptedRevision = await getAcceptedRevision();
    const updated = applyDevelopmentCompletion(current.data, completion, {acceptedRevision});
    if (updated === current.data) return updated;
    try { await store.write('snapshot.json', updated, current.generation); return updated; }
    catch (error) { if (error.status !== 412 || attempt === 2) throw error; }
  }
}

/** Durable local outbox retains failures for the same receipt to be retried. */
export async function recordDevelopmentCompletion(root, completion, {acceptedRevision, publish} = {}) {
  const snapshotPath = path.join(root, 'docs/reports/platform-release-readiness/src/data.json');
  const current = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const updated = applyDevelopmentCompletion(current, completion, {acceptedRevision});
  const directory = path.join(root, 'artifacts/development-progress');
  await mkdir(directory, {recursive: true});
  const receiptPath = path.join(directory, `${completion.taskId.replaceAll(':', '_')}-${completion.revision}.json`);
  await writeFile(receiptPath, JSON.stringify({completion, sync: 'pending'}, null, 2) + '\n');
  const temporary = `${snapshotPath}.${process.pid}.tmp`;
  try { await writeFile(temporary, JSON.stringify(updated, null, 2) + '\n', {flag: 'wx'}); await rename(temporary, snapshotPath); }
  catch (error) { throw new Error(`Local dashboard update failed: ${error.message}`, {cause: error}); }
  try {
    if (publish) await publish(completion);
    await writeFile(receiptPath, JSON.stringify({completion, sync: publish ? 'published' : 'local', nextAction: publish ? 'Existing dashboard refreshes within one minute.' : 'Publish accepted-revision receipt to the existing dashboard.'}, null, 2) + '\n');
  } catch (error) {
    await writeFile(receiptPath, JSON.stringify({completion, sync: 'failed', error: error.message, nextAction: 'Retry this receipt after restoring dashboard delivery.'}, null, 2) + '\n');
    throw error;
  }
  return updated;
}
