import {spawn, execFileSync} from 'node:child_process';
import {openSync, closeSync} from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';

const self = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(self), '../../..');
const cleanEnvironment = {...process.env};
for (const key of ['DEBUG', 'FIREBASE_DEBUG', 'FIREBASE_CLI_LOGGING', 'NODE_DEBUG', 'SNAP_COOKIE']) delete cleanEnvironment[key];
const arguments_ = process.argv.slice(2);
const mode = arguments_.shift();
let runner = 'remaining';
if (arguments_[0] === '--runner') {arguments_.shift(); runner = arguments_.shift();}
const [label, ...indices] = arguments_;
const runners = {remaining: 'run-remaining-manifest-checks.mjs', standalone: 'run-standalone-manifest-checks.mjs', main: 'run-main-manifest-checks.mjs', backend: 'run-backend-exact-manifest-checks.mjs', receipts: 'record-local-manifest-completions.mjs'};
if (!['--launch', '--run'].includes(mode) || !Object.hasOwn(runners, runner) || !/^[a-z0-9-]{1,80}$/u.test(label ?? '') || (runner === 'remaining' && !indices.length) || indices.some(index => !/^\d+$/u.test(index))) throw new Error('Usage: supervisor --launch|--run [--runner remaining|standalone|main|backend|receipts] label [indices...]');
const entrypoint = path.join(path.dirname(self), runners[runner]);
const evidenceDirectory = runner === 'remaining' ? `artifacts/development-checks/goal-20261024-${label}` : `artifacts/development-checks/goal-20261024-${runner}-${label}`;
const runnerArguments = runner === 'remaining' ? indices : [...indices, `--output=${evidenceDirectory}`];
const directory = path.join(root, 'artifacts/goal-completion-2026-10-24/riddle/manifest-supervisors', label);
await mkdir(path.dirname(directory), {recursive: true});
await mkdir(directory, {recursive: mode === '--run'});
const statusFile = path.join(directory, 'status.json');
const logFile = path.join(directory, 'runner.log');
if (mode === '--launch') {
  const descriptor = openSync(path.join(directory, 'supervisor.log'), 'a', 0o600);
  const child = spawn(process.execPath, [self, '--run', '--runner', runner, label, ...indices], {cwd: root, detached: true,
    stdio: ['ignore', descriptor, descriptor], env: {...cleanEnvironment, DEBUG: ''}});
  child.unref(); closeSync(descriptor);
  console.log(JSON.stringify({supervisorPid: child.pid, runner, label, indices: indices.map(Number), selection: indices.length ? 'explicit' : 'all declared checks for this runner', evidenceDirectory, status: path.relative(root, statusFile)}));
} else {
  const descriptor = openSync(logFile, 'a', 0o600);
  const record = {label, runner, entrypoint: path.relative(root, entrypoint), runnerArguments, evidenceDirectory, indices: indices.map(Number), selection: indices.length ? 'explicit' : 'all declared checks for this runner', supervisorPid: process.pid, startedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    sourceBefore: await developmentSourceDigest(root), status: 'running', inheritedDebugDisabled: true, unneededDesktopCapabilityRemoved: true, maximumRuntimeMinutes: 45};
  record.report = `${evidenceDirectory}/${runner === 'remaining' ? record.sourceBefore + '.json' : 'report.json'}`;
  const child = spawn(process.execPath, [entrypoint, ...runnerArguments],
    {cwd: root, detached: true, stdio: ['ignore', descriptor, descriptor], env: {...cleanEnvironment, DEBUG: '', MANIFEST_CHECK_REPORT_LABEL: label}});
  record.childPid = child.pid;
  await writeFile(statusFile, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
  let timedOut = false;
  const stopGroup = signal => {try {process.kill(-child.pid, signal);} catch (error) {if (error.code !== 'ESRCH') throw error;}};
  const timeout = setTimeout(() => {timedOut = true; stopGroup('SIGTERM'); setTimeout(() => stopGroup('SIGKILL'), 5000);}, 45 * 60 * 1000);
  const result = await new Promise(resolve => {
    child.once('error', error => resolve({exitCode: null, error: error.message}));
    child.once('close', (exitCode, signal) => resolve({exitCode, signal}));
  });
  clearTimeout(timeout); closeSync(descriptor);
  Object.assign(record, result, {sourceAfter: await developmentSourceDigest(root), finishedAt: new Date().toISOString(),
    status: timedOut ? 'timed-out' : result.exitCode === 0 ? 'passed' : 'failed'});
  record.sourceStillMatches = record.sourceBefore === record.sourceAfter;
  await writeFile(statusFile, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
}
