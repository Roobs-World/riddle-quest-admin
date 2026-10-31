import {execFile, execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';
import {reuseDevelopmentChecks} from '../../../scripts/release/development-check-reuse.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const execute = promisify(execFile), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const sourceDigest = await developmentSourceDigest(root);
const auditDirectory = 'artifacts/goal-completion-2026-10-24/riddle/manifest-evidence-audit';
const audit = JSON.parse(await readFile(path.join(root, auditDirectory, `${sourceDigest}-audit.json`), 'utf8'));
const acceptance = JSON.parse(await readFile(path.join(root, auditDirectory, `${sourceDigest}-acceptance.json`), 'utf8'));
if (audit.revision !== revision || acceptance.revision !== revision || audit.sourceDigest !== sourceDigest || acceptance.sourceDigest !== sourceDigest ||
  audit.exactCommands !== audit.requiredExactCommands || audit.missingExactCommandIndices.length || audit.failedExactCommands.length || audit.rejected.length ||
  audit.verifiedManifests !== audit.manifestCount) throw new Error('Every current exact required command and manifest must pass before local recording');
const originalReportFile = audit.checksReport, reportBytes = await readFile(path.join(root, originalReportFile)), checksReport = JSON.parse(reportBytes);
const outputArgument = process.argv.find(value => value.startsWith('--output='));
const outputDirectory = outputArgument?.slice('--output='.length);
if (!/^artifacts\/development-checks\/[a-zA-Z0-9._-]+$/u.test(outputDirectory ?? '')) throw new Error('Provide one owned --output directory');
const selected = new Set(process.argv.slice(2).filter(value => /^\d+$/u.test(value)).map(Number));
const directory = path.join(root, outputDirectory); await mkdir(directory, {recursive: true});
const reportFile = path.relative(root, path.join(directory, 'checks-report-snapshot.json'));
try {await writeFile(path.join(root, reportFile), reportBytes, {flag: 'wx', mode: 0o600});}
catch (error) {if (error.code !== 'EEXIST' || hash(await readFile(path.join(root, reportFile))) !== hash(reportBytes)) throw error;}
const dataFile = path.join(root, 'docs/reports/platform-release-readiness/src/data.json');
const progressFile = path.join(directory, 'report.json');
const progress = {revision, sourceDigest, originalChecksReport: originalReportFile, checksReport: reportFile, checksReportSha256: hash(reportBytes), startedAt: new Date().toISOString(),
  scope: 'Local canonical Development Completion recording only. Remaining gates and nextAction stay verbatim; no external publication is supported.', results: []};
const save = () => writeFile(progressFile, JSON.stringify(progress, null, 2) + '\n');
const manifests = (await readdir(path.join(root, 'docs/development-tasks'))).filter(file => file.endsWith('.json')).sort();
const tasks = await Promise.all(manifests.map(async (file, index) => ({index, file: `docs/development-tasks/${file}`, task: JSON.parse(await readFile(path.join(root, 'docs/development-tasks', file), 'utf8'))})));
const eligible = tasks.filter(row => (!selected.size || selected.has(row.index)) && acceptance.tasks.some(item => item.taskId === row.task.taskId && item.localReceiptPromotion === 'eligible-local-development-only'));
progress.held = tasks.filter(row => !acceptance.tasks.some(item => item.taskId === row.task.taskId && item.localReceiptPromotion === 'eligible-local-development-only')).map(row => row.task.taskId);
progress.selected = eligible.length;
if (!eligible.length) throw new Error('No eligible local completion receipts');
async function snapshotMetadata() {
  const snapshot = JSON.parse(await readFile(dataFile, 'utf8'));
  const rows = snapshot.queries.development_progress?.rows ?? [];
  const otherQueries = Object.fromEntries(Object.entries(snapshot.queries).filter(([key]) => key !== 'development_progress'));
  return {rows, rowsCount: rows.length, rowsSha256: hash(JSON.stringify(rows)), otherQueriesSha256: hash(JSON.stringify(otherQueries)), id: snapshot.id};
}
const prior = await snapshotMetadata();
progress.priorDevelopmentRows = prior.rowsCount; progress.priorDevelopmentRowsSha256 = prior.rowsSha256;
progress.otherQuerySha256 = prior.otherQueriesSha256; progress.dashboardId = prior.id;
const priorRows = prior.rows.map(row => hash(JSON.stringify(row)));
prior.rows = null;
async function authoringStatus(value) {
  const snapshot = JSON.parse(await readFile(dataFile, 'utf8')); snapshot.buildStatus = value;
  const temporary = path.join(directory, `snapshot-status-${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', {mode: (await stat(dataFile)).mode & 0o777});
  await rename(temporary, dataFile);
}
await save(); await authoringStatus('updating');
async function verifyReceipt(task, file) {
  const receipt = JSON.parse(await readFile(file, 'utf8')), completion = receipt.completion;
  if (completion.taskId !== task.taskId || completion.revision !== revision || completion.sourceDigest !== sourceDigest || completion.work !== task.work ||
    JSON.stringify(completion.targets) !== JSON.stringify(task.targets) || JSON.stringify(completion.remainingGates) !== JSON.stringify(task.remainingGates) || completion.nextAction !== task.nextAction ||
    JSON.stringify(completion.requiredChecks) !== JSON.stringify(task.checks.map(check => check.id))) throw new Error(`Existing completion fields conflict for ${task.taskId}`);
  const expectedChecks = await reuseDevelopmentChecks(root, task, checksReport, {revision, sourceDigest});
  if (JSON.stringify(completion.checks) !== JSON.stringify(expectedChecks)) throw new Error(`Completion check evidence differs for ${task.taskId}`);
  const expectedArtifacts = await Promise.all((task.artifacts ?? []).map(async artifact => ({...artifact, sha256: hash(await readFile(path.join(root, artifact.file)))})));
  if (JSON.stringify(completion.artifacts) !== JSON.stringify(expectedArtifacts)) throw new Error(`Completion artifact evidence differs for ${task.taskId}`);
  return receipt;
}
try {
  for (const row of eligible) {
    if (await developmentSourceDigest(root) !== sourceDigest || hash(await readFile(path.join(root, reportFile))) !== progress.checksReportSha256) throw new Error('Source or check report changed during recording');
    const receiptFile = path.join(root, 'artifacts/development-progress', `${row.task.taskId.replaceAll(':', '_')}-${revision}.json`);
    let existing;
    try {existing = await verifyReceipt(row.task, receiptFile);} catch (error) {if (error.code !== 'ENOENT') throw error;}
    if (existing && !['local', 'pending'].includes(existing.sync)) throw new Error(`Preserve existing ${existing.sync} delivery state for ${row.task.taskId}; local recording cannot replace it`);
    let result, operation = 'recorded';
    if (existing?.sync === 'local') {operation = 'reused-verified-local-receipt'; result = {stdout: '', stderr: ''};}
    else {
      const args = existing ? ['scripts/release/complete-development-task.mjs', '--retry', receiptFile] :
        ['scripts/release/complete-development-task.mjs', row.file, '--checks-report', reportFile];
      result = await execute(process.execPath, args, {cwd: root, maxBuffer: 1024 * 1024, timeout: 180_000});
      if (existing) operation = 'retried-verified-local-receipt';
    }
    const receipt = await verifyReceipt(row.task, receiptFile);
    if (receipt.sync !== 'local') throw new Error(`Receipt is not local for ${row.task.taskId}`);
    const log = path.join(directory, `${String(row.index).padStart(3, '0')}.log`), output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    await writeFile(log, output);
    progress.results.push({taskId: row.task.taskId, manifest: row.file, operation, status: 'passed', checkedAt: new Date().toISOString(),
      receipt: path.relative(root, receiptFile), receiptSha256: hash(await readFile(receiptFile)), log: path.relative(root, log), logSha256: hash(output),
      remainingGatesPreserved: true, nextActionPreserved: true});
    await save(); console.log(`${progress.results.length}/${eligible.length}: ${operation} ${row.task.taskId}`);
  }
  const final = await snapshotMetadata();
  if (final.id !== progress.dashboardId || final.otherQueriesSha256 !== progress.otherQuerySha256 ||
    priorRows.some((digest, index) => hash(JSON.stringify(final.rows[index])) !== digest)) throw new Error('Prior dashboard rows, identity or unrelated provider queries changed');
  for (const row of eligible) {
    const found = final.rows.filter(item => item.taskId === row.task.taskId && item.revision === revision && item.sourceDigest === sourceDigest);
    if (found.length !== row.task.targets.length || row.task.targets.some(target => found.filter(item => item.target === target).length !== 1)) throw new Error(`Dashboard receipt rows are incomplete for ${row.task.taskId}`);
  }
  progress.finalDevelopmentRows = final.rowsCount; progress.priorRowsPreserved = true; progress.otherQueriesPreserved = true;
  progress.developmentRowGrain = 'One task-target row per revision/source completion; each row contains all required check evidence for that task. Rows are not individual checks.';
  progress.newTaskTargetRows = final.rowsCount - progress.priorDevelopmentRows;
  progress.expectedTaskTargetRowsForSelectedReceipts = eligible.reduce((sum, row) => sum + row.task.targets.length, 0);
  await authoringStatus('complete');
  progress.sourceAfter = await developmentSourceDigest(root); progress.sourceStillMatches = progress.sourceAfter === sourceDigest;
  if (!progress.sourceStillMatches) throw new Error('Source changed after recording');
  progress.status = 'passed'; progress.completedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({recordedOrReused: progress.results.length, priorRowsPreserved: true, otherQueriesPreserved: true, sourceStillMatches: true, report: path.relative(root, progressFile)}));
} catch (error) {progress.status = 'failed'; progress.reason = error.message; progress.completedAt = new Date().toISOString(); await save(); throw error;}
