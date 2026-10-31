import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile, mkdir, readdir, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';

for (const key of ['DEBUG','FIREBASE_DEBUG','FIREBASE_CLI_LOGGING','NODE_DEBUG']) delete process.env[key];

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const execute = promisify(execFile);
const union = JSON.parse(await readFile(path.join(directory, 'manifest-check-union.json'), 'utf8'));
const outputArgument = process.argv.find(value => value.startsWith('--output='));
const outputDirectory = outputArgument?.slice('--output='.length) ?? 'artifacts/development-checks/goal-20261024-main-browser';
if (!/^artifacts\/development-checks\/[a-zA-Z0-9._-]+$/.test(outputDirectory)) throw new Error('Output must be one owned development-checks directory');
const logDirectory = path.join(root, outputDirectory);
await mkdir(logDirectory, {recursive: true});
const requested = new Set(process.argv.slice(2).filter(value => /^\d+$/.test(value)).map(Number));
const selected = union.checks.map((check, index) => ({...check, index})).filter(check => {
  const args = check.executable === 'node' ? check.args : check.executable === 'env' && check.args[0] === 'RACE_REACT_DEVELOPMENT=1' && check.args[1] === 'node' ? check.args.slice(2) : [];
  return [150,151,153,170,178].includes(check.index) && (!requested.size || requested.has(check.index));
});
if (!selected.length) throw new Error('No standalone browser checks selected');
const manifests = [];
for (const file of await readdir(path.join(root, 'docs/development-tasks'))) {
  if (file.endsWith('.json')) manifests.push(JSON.parse(await readFile(path.join(root, 'docs/development-tasks', file), 'utf8')));
}
function declaredArtifacts(check) {
  const files = new Set();
  for (const manifest of manifests.filter(item => check.tasks.includes(item.taskId))) {
    const ids = new Set(manifest.checks.filter(item => item.executable === check.executable && JSON.stringify(item.args) === JSON.stringify(check.args)).map(item => item.id));
    for (const artifact of manifest.artifacts ?? []) if (!artifact.checkId || ids.has(artifact.checkId)) files.add(artifact.file);
  }
  return [...files];
}
const {stdout} = await execute('git', ['rev-parse', 'HEAD'], {cwd: root});
const sourceDigest = await developmentSourceDigest(root);
const reportFile = path.join(logDirectory, 'report.json');
let prior;
try {prior = JSON.parse(await readFile(reportFile, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
const report = prior?.sourceDigest === sourceDigest && prior.revision === stdout.trim() ? prior : {revision: stdout.trim(), sourceDigest, startedAt: new Date().toISOString(), checks: []};
const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
for (const check of selected) {
  const previous = report.checks.find(row => row.index === check.index && row.status === 'passed');
  if (previous) {
    const log = await readFile(path.join(root, previous.log));
    let artifactsMatch = true;
    for (const file of declaredArtifacts(check)) {
      try {if (createHash('sha256').update(await readFile(path.join(root, file))).digest('hex') !== previous.artifacts?.[file]) artifactsMatch = false;}
      catch {artifactsMatch = false;}
    }
    if (artifactsMatch && createHash('sha256').update(log).digest('hex') === previous.sha256) {console.log(`Reuse ${check.index}: ${check.args.at(-1)}`); continue;}
  }
  const sourceBefore = await developmentSourceDigest(root);
  if (sourceBefore !== sourceDigest) throw new Error('Source changed; restart verification after edits settle');
  const log = path.join(logDirectory, `${String(check.index).padStart(3, '0')}.log`);
  const startedAt = new Date().toISOString();
  console.log(`Start ${check.index}: ${check.executable} ${check.args.join(' ')}`);
  let output = '', status = 'passed', exitCode = 0;
  try {
    const result = await execute(check.executable, check.args, {cwd: root, maxBuffer: 32 * 1024 * 1024, timeout: 900_000});
    output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  } catch (error) {
    status = 'failed'; exitCode = error.code ?? null;
    output = `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.message}\n`;
  }
  await writeFile(log, output);
  const artifacts = {}, artifactSnapshots = {};
  for (const file of declaredArtifacts(check)) {
    try {
      artifacts[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
      const snapshot = path.join(logDirectory, `${String(check.index).padStart(3, '0')}-artifacts`, file);
      await mkdir(path.dirname(snapshot), {recursive: true});
      await copyFile(path.join(root, file), snapshot);
      artifactSnapshots[file] = path.relative(root, snapshot);
    } catch (error) {status = 'failed'; output += `\nDeclared artifact unavailable: ${file}: ${error.message}\n`;}
  }
  await writeFile(log, output);
  const sourceAfter = await developmentSourceDigest(root);
  if (sourceAfter !== sourceBefore) status = 'failed';
  const row = {index: check.index, executable: check.executable, args: check.args, tasks: check.tasks, sourceBefore, sourceAfter, status, exitCode, startedAt, checkedAt: new Date().toISOString(), log: path.relative(root, log), sha256: createHash('sha256').update(output).digest('hex'), artifacts, artifactSnapshots};
  report.checks = report.checks.filter(item => item.index !== check.index);
  report.checks.push(row);
  await save();
  console.log(`${status} ${check.index}: ${check.args.at(-1)}`);
}
report.completedAt = new Date().toISOString();
report.sourceStillMatches = await developmentSourceDigest(root) === sourceDigest;
await save();
const failures = report.checks.filter(check => check.status !== 'passed');
console.log(JSON.stringify({selected: selected.length, completed: report.checks.length, failed: failures.map(check => check.index), sourceStillMatches: report.sourceStillMatches, report: path.relative(root, reportFile)}));
if (failures.length || !report.sourceStillMatches) process.exitCode = 1;
