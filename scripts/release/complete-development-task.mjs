#!/usr/bin/env node
import {execFile, execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {releaseRepository} from './html5-handoff-preparation.mjs';
import {recordDevelopmentCompletion, publishDevelopmentCompletion} from './development-progress.mjs';
import {googleClient, snapshotStore} from '../../tooling/deployment-monitor/google.mjs';
import {developmentSourceDigest} from './development-source-digest.mjs';
const execute = promisify(execFile);
const git = args => execFileSync('git', args, {cwd: releaseRepository, encoding: 'utf8'}).trim();
const revision = git(['rev-parse', 'HEAD']);
let completion;
if (process.argv[2] === '--ci') {
  if (process.env.GITHUB_SHA !== revision) throw new Error('CI checkout does not match the verified revision');
  const jobs = JSON.parse(process.env.DEVELOPMENT_VERIFICATION_JOBS ?? '{}');
  const requiredChecks = ['workspace-node24', 'functions-node22', 'browser-and-rules'];
  if (requiredChecks.some(id => jobs[id]?.result !== 'success')) throw new Error('CI verification is incomplete');
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  completion = {taskId: `ci-production-readiness:${revision}`, revision, targets: JSON.parse(process.env.DEVELOPMENT_TARGETS ?? '["jest","facebook","reddit","youtube","netflix","yahoo","itch"]'),
    work: git(['log', '-1', '--format=%s']), completedAt: new Date().toISOString(), trigger: 'accepted-revision CI', requiredChecks,
    checks: requiredChecks.map(id => ({id, status: 'passed', evidence: `${runUrl} (${id})`})),
    remainingGates: ['Provider submission, review, approval and publication require separate receipts.'],
    nextAction: 'Review each affected platform\'s existing manual submission gates.'};
} else if (process.argv[2] === '--retry') {
  const receipt = JSON.parse(await readFile(process.argv[3], 'utf8'));
  completion = receipt.completion;
} else {
  if (!process.argv[2]) throw new Error('Usage: complete-development-task.mjs task.json | --ci | --retry receipt.json [--publish]');
  const task = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (!Array.isArray(task.checks) || !task.checks.length) throw new Error('Task must declare required checks');
  const sourceDigest = await developmentSourceDigest(releaseRepository);
  const checks = [];
  for (const check of task.checks) {
    if (!check.id || !check.executable || !Array.isArray(check.args)) throw new Error('Invalid check command');
    const result = await execute(check.executable, check.args, {cwd: releaseRepository, maxBuffer: 32 * 1024 * 1024});
    checks.push({id: check.id, status: 'passed', evidence: `${check.executable} ${check.args.join(' ')}; output SHA-256 ${createHash('sha256').update(result.stdout).update(result.stderr).digest('hex')}`});
  }
  if (git(['rev-parse', 'HEAD']) !== revision || await developmentSourceDigest(releaseRepository) !== sourceDigest) throw new Error('Revision changed during verification');
  completion = {taskId: task.taskId, targets: task.targets, work: task.work, revision,
    sourceDigest,
    completedAt: new Date().toISOString(), trigger: 'local verified handoff',
    requiredChecks: task.checks.map(check => check.id), checks, remainingGates: task.remainingGates, nextAction: task.nextAction, artifacts: []};
  for (const artifact of task.artifacts ?? []) completion.artifacts.push({...artifact, sha256: createHash('sha256').update(await readFile(artifact.file)).digest('hex')});
}
const publish = process.argv.includes('--publish');
let store;
if (publish) {
  const accessToken = process.env.MONITOR_ACCESS_TOKEN ?? execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8'}).trim();
  store = snapshotStore(googleClient({accessToken}), 'riddle-quest-monitoring-ec2b2');
}
// Remote publication always checks the configured accepted branch, never a PR checkout.
const getAcceptedRevision = async () => {
  const branch = process.env.DEVELOPMENT_ACCEPTED_BRANCH ?? 'main';
  if (!/^[a-zA-Z0-9_/-]+$/.test(branch)) throw new Error('Invalid accepted branch');
  const {stdout} = await execute('git', ['ls-remote', 'origin', `refs/heads/${branch}`], {cwd: releaseRepository});
  return stdout.split(/\s/u)[0];
};
await recordDevelopmentCompletion(releaseRepository, completion, {acceptedRevision: revision,
  ...(publish ? {publish: value => publishDevelopmentCompletion(store, value, {getAcceptedRevision})} : {})});
console.log(`Recorded ${completion.taskId} for ${completion.targets.join(', ')}${publish ? ' and refreshed the existing dashboard snapshot' : ' in the local dashboard'}.`);
