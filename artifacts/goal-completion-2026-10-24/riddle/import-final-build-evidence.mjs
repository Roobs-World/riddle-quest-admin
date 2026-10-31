import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const input = process.argv[2] ?? 'artifacts/goal-completion-2026-10-24/riddle/final/build-status.json';
const inputBytes = await readFile(path.join(root, input));
const batch = JSON.parse(inputBytes);
const sourceDigest = await developmentSourceDigest(root);
if (!batch.complete || !batch.sourceHashesUnchanged || batch.sourceDigest !== sourceDigest || batch.sourceDigestAfter !== sourceDigest) throw new Error('Final build batch source is stale or incomplete');
const execute = promisify(execFile);
const {stdout} = await execute('git', ['rev-parse', 'HEAD'], {cwd: root});
const hash = value => createHash('sha256').update(value).digest('hex');
const union = JSON.parse(await readFile(path.join(root, 'artifacts/goal-completion-2026-10-24/riddle/manifest-check-union.json'), 'utf8'));
const artifacts = {};
for (const file of await readdir(path.join(root, 'docs/development-tasks'))) {
  if (!file.endsWith('.json')) continue;
  const manifest = JSON.parse(await readFile(path.join(root, 'docs/development-tasks', file), 'utf8'));
  for (const artifact of manifest.artifacts ?? []) artifacts[artifact.file] = hash(await readFile(path.join(root, artifact.file)));
}
const observedAt = new Date().toISOString();
const label = process.argv[3] ?? `final-build-import-${sourceDigest.slice(0, 12)}-${stdout.trim().slice(0, 12)}`;
if (!/^[a-z0-9-]+$/u.test(label)) throw new Error('Invalid build evidence label');
const directory = path.join(root, `artifacts/development-checks/goal-20261024-${label}`);
await mkdir(directory, {recursive: true});
const checks = [];
for (const result of batch.results) {
  const [executable, ...args] = result.command;
  const index = union.checks.findIndex(check => check.executable === executable && JSON.stringify(check.args) === JSON.stringify(args));
  if (index < 0) throw new Error(`Build batch command is not an exact manifest declaration: ${result.name}`);
  if (result.exitCode !== 0) throw new Error(`Build batch failed: ${result.name}`);
  const originalLog = path.join(path.dirname(input), result.log);
  const bytes = await readFile(path.join(root, originalLog));
  const sha256 = hash(bytes);
  const log = path.join(directory, `${sourceDigest}-${String(index).padStart(3, '0')}-${sha256}.log`);
  await copyFile(path.join(root, originalLog), log);
  checks.push({index, executable, args, ids: [...new Set(union.checks[index].checkIds)], tasks: union.checks[index].tasks,
    status: 'passed', exitCode: 0, startedAt: batch.startedAt, checkedAt: batch.completedAt, timingScope: 'containing sequential verification batch',
    sourceBefore: batch.sourceDigest, sourceAfter: batch.sourceDigestAfter, sourceStillMatches: true,
    log: path.relative(root, log), sha256, artifacts, artifactsObservedAt: observedAt,
    provenance: {kind: 'imported-exact-execution', originalStatus: input, originalStatusSha256: hash(inputBytes), originalLog,
      note: 'The recorded command executed in the original batch. This import copied and hashed its existing output; it did not rerun or substitute any command.'}});
}
const report = {revision: stdout.trim(), sourceDigest, sourceStillMatches: true, importedAt: observedAt, checks};
const reportFile = path.join(directory, 'report.json');
await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
if (await developmentSourceDigest(root) !== sourceDigest) throw new Error('Source changed during evidence import');
console.log(JSON.stringify({sourceDigest, checks: checks.map(row => row.index), report: path.relative(root, reportFile)}));
