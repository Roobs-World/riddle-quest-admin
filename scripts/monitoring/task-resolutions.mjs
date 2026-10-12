import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// A completion survives refresh only while its verified source files still match.
export async function applyTaskResolutions(tasks, root) {
  let ledger;
  try { ledger = JSON.parse(await readFile(path.join(root, 'docs/task-resolutions.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {records: 0, stale: 0}; throw error; }
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.resolutions)) throw new Error('Invalid task resolution ledger');
  const ids = new Set();
  let stale = 0;
  for (const resolution of ledger.resolutions) {
    const task = tasks.find(row => row.id === resolution.taskId);
    if (!task || ids.has(resolution.taskId)) throw new Error(`Unknown or duplicate resolution: ${resolution.taskId}`);
    ids.add(resolution.taskId);
    if (!['Complete', 'Locally verified', 'Blocked'].includes(resolution.status) || !resolution.description || !resolution.nextAction || !Number.isFinite(Date.parse(resolution.verifiedAt))) throw new Error('Incomplete resolution');
    const evidence = resolution.evidence;
    if (!evidence?.checks?.length || !evidence.files?.length) throw new Error('Resolution lacks verification evidence');
    let matches = true;
    for (const entry of evidence.files) {
      if (!entry.file || path.isAbsolute(entry.file) || entry.file.split(/[\\/]/).includes('..') || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid resolution file');
      try {
        const bytes = await readFile(path.join(root, entry.file));
        matches &&= createHash('sha256').update(bytes).digest('hex') === entry.sha256;
      } catch (error) { if (error.code !== 'ENOENT') throw error; matches = false; }
    }
    const obsolete = !matches && resolution.status !== 'Blocked';
    if (obsolete) stale++;
    Object.assign(task, {
      status: obsolete ? 'Verification pending' : resolution.status,
      description: resolution.description,
      nextAction: obsolete ? 'Source changed since the completion receipt; re-run the relevant checks and refresh the receipt' : resolution.nextAction,
      updatedAt: resolution.verifiedAt,
      resolutionEvidence: {...evidence, sourceMatches: matches},
      evidenceNote: obsolete ? 'Recorded completion is stale because source hashes changed.' : 'Explicit resolution with recorded checks and matching source hashes. Provider and client acceptance remain separate.',
    });
    task.sources.push({project: task.project, file: 'docs/task-resolutions.json'});
  }
  return {records: ids.size, stale};
}
