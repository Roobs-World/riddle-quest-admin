import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';
import {executeDevelopmentCheck} from '../../../scripts/release/development-check-output.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const execute = promisify(execFile);
const union = JSON.parse(await readFile(path.join(directory, 'manifest-check-union.json'), 'utf8'));
const selected = process.argv.slice(2).map(Number);
if (!selected.length || selected.some(index => !Number.isInteger(index) || !union.checks[index])) throw new Error('Provide exact manifest-union indices');
const label = process.env.MANIFEST_CHECK_REPORT_LABEL ?? 'remaining';
if (!/^[a-z0-9-]+$/u.test(label)) throw new Error('Invalid report label');
const reportDirectory = path.join(root, `artifacts/development-checks/goal-20261024-${label}`);
await mkdir(reportDirectory, {recursive: true});
const {stdout} = await execute('git', ['rev-parse', 'HEAD'], {cwd: root});
const revision = stdout.trim();
const sourceDigest = await developmentSourceDigest(root);
const reportFile = path.join(reportDirectory, `${sourceDigest}.json`);
let prior;
try {prior = JSON.parse(await readFile(reportFile, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
const report = prior ?? {revision, sourceDigest, startedAt: new Date().toISOString(), checks: []};
if (report.revision !== revision || report.sourceDigest !== sourceDigest) throw new Error('Existing report source mismatch');
const artifactFiles = new Set();
for (const name of await readdir(path.join(root, 'docs/development-tasks'))) {
  if (!name.endsWith('.json')) continue;
  const task = JSON.parse(await readFile(path.join(root, 'docs/development-tasks', name), 'utf8'));
  for (const artifact of task.artifacts ?? []) artifactFiles.add(artifact.file);
}
const hash = value => createHash('sha256').update(value).digest('hex');
const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
let failed = false;
for (const index of selected) {
  const check = union.checks[index];
  const currentDigest = await developmentSourceDigest(root);
  const previous = report.checks.find(row => row.index === index && row.status === 'passed' &&
    (row.sourceBefore ?? sourceDigest) === currentDigest && (row.sourceAfter ?? sourceDigest) === currentDigest);
  if (previous) {
    let intact = hash(await readFile(path.join(root, previous.log))) === previous.sha256;
    for (const [file, digest] of Object.entries(previous.artifacts ?? {})) {
      try {intact &&= hash(await readFile(path.join(root, file))) === digest;} catch {intact = false;}
    }
    if (intact) {console.log(`Reuse ${index}`); continue;}
  }
  const sourceBefore = await developmentSourceDigest(root);
  const startedAt = new Date().toISOString();
  console.log(`Start ${index} at ${startedAt}: ${check.executable} ${check.args.join(' ')}`);
  let output = '', status = 'passed', exitCode = 0, reason;
  try {
    const result = await executeDevelopmentCheck({...check, id: [...new Set(check.checkIds)].join(',')}, execute,
      {cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000});
    output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  } catch (error) {
    status = 'failed'; exitCode = error.code ?? null; reason = error.message; failed = true;
    output = `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.message}\n`;
  }
  const log = path.join(reportDirectory, `${sourceBefore}-${String(index).padStart(3, '0')}-${hash(output)}.log`);
  await writeFile(log, output);
  const artifacts = {};
  for (const file of artifactFiles) {
    try {artifacts[file] = hash(await readFile(path.join(root, file)));}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const sourceAfter = await developmentSourceDigest(root);
  const sourceStillMatches = sourceBefore === sourceAfter;
  const row = {index, executable: check.executable, args: check.args, ids: [...new Set(check.checkIds)], tasks: check.tasks,
    status, exitCode, ...(reason ? {reason} : {}), startedAt, checkedAt: new Date().toISOString(),
    log: path.relative(root, log), sha256: hash(output), artifacts, sourceBefore, sourceAfter, sourceStillMatches};
  report.checks = report.checks.filter(item => item.index !== index);
  report.checks.push(row);
  report.updatedAt = row.checkedAt;
  await save();
  console.log(`${status} ${index} at ${row.checkedAt}; source matches ${sourceStillMatches}`);
}
report.completedAt = new Date().toISOString();
report.sourceStillMatches = await developmentSourceDigest(root) === sourceDigest;
await save();
console.log(JSON.stringify({selected: selected.length, recorded: report.checks.length, failed: report.checks.filter(row => row.status !== 'passed').map(row => row.index), report: path.relative(root, reportFile), sourceStillMatches: report.sourceStillMatches}));
if (failed || !report.sourceStillMatches) process.exitCode = 1;
