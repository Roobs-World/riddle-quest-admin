import {execFileSync} from 'node:child_process';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';
import {measureSourceSize} from '../../../scripts/source-size-metric.mjs';
import {reuseDevelopmentChecks} from '../../../scripts/release/development-check-reuse.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
if (!process.argv[2]) throw new Error('Pass the current manifest evidence audit JSON');
const verification = JSON.parse(await readFile(path.resolve(root, process.argv[2]), 'utf8'));
const sourceDigest = await developmentSourceDigest(root);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
if (verification.sourceDigest !== sourceDigest || verification.revision !== revision) throw new Error('Acceptance audit requires current-source verification');
const checksReport = JSON.parse(await readFile(path.resolve(root, verification.checksReport), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const sessionFile = 'packages/portal/src/play/race/RaceSession.ts';
const authorityFile = 'packages/portal/src/play/race/RaceOwnedAuthority.ts';
const session = await readFile(path.join(root, sessionFile), 'utf8');
const authority = await readFile(path.join(root, authorityFile), 'utf8');
const structuralReview = {reviewedAt: new Date().toISOString(), sessionFile, sessionSha256: hash(session), authorityFile, authoritySha256: hash(authority),
  equivalentLines: measureSourceSize(session, '.ts'), limit: 500,
  metric: 'Non-whitespace implementation characters excluding standalone TSDoc divided by 80, rounded up.',
  privateAuthorityExtracted: /import\s*\{RaceOwnedAuthority\}\s*from\s*["']\.\/RaceOwnedAuthority["']/u.test(session) &&
    /private readonly authority\s*=\s*new RaceOwnedAuthority\(/u.test(session) && /export class RaceOwnedAuthority/u.test(authority),
  canonicalHistoryOwnedByExtractedAuthority: /import\s*\{RaceConfirmedHistory\}/u.test(authority) &&
    /this\.authority\.previewHistory/u.test(session) && /this\.authority\.confirmRun/u.test(session)};
structuralReview.status = structuralReview.equivalentLines <= structuralReview.limit && structuralReview.privateAuthorityExtracted && structuralReview.canonicalHistoryOwnedByExtractedAuthority ? 'passed' : 'failed';
const gateCatalogue = new Map(), tasks = [];
const gateKind = gate => /merge.*main/iu.test(gate) ? 'separate-main-branch-ci-integration' :
  /(?:provider|publication|submission|listing|publish backend|\bdeployment\b|\bactivation\b)/iu.test(gate) ? 'separate-provider-or-deployment-gate' :
    /(?:canonical-history continuity|unavailable-Daily|shared documentation|workspace.*stable|promote prototype)/iu.test(gate) ? 'scoped-implementation-verification' : 'separate-comprehensive-project-audit';
for (const file of (await readdir(path.join(root, 'docs/development-tasks'))).filter(file => file.endsWith('.json')).sort()) {
  const relative = `docs/development-tasks/${file}`, bytes = await readFile(path.join(root, relative));
  const task = JSON.parse(bytes);
  const holds = [];
  let requiredChecksStatus = 'verified-current-source';
  try {await reuseDevelopmentChecks(root, task, checksReport, {revision, sourceDigest});}
  catch (error) {requiredChecksStatus = 'unverified'; holds.push(error.message);}
  const extraCriteria = [];
  if (task.taskId === 'multiplayer:race-history-integration-prototype') {
    extraCriteria.push({criterion: 'Private authority ownership extracted and RaceSession within 500 equivalent lines, with current owning verification.', ...structuralReview});
    if (structuralReview.status !== 'passed') holds.push('Prototype authority extraction or source-size implementation criterion is unmet');
  }
  const separateGates = (task.remainingGates ?? []).map(text => {
    const kind = gateKind(text);
    const isImplementation = kind === 'scoped-implementation-verification';
    const status = isImplementation && !holds.length ? 'covered-by-current-owning-checks-and-source-review' : isImplementation ? 'awaiting-current-implementation-verification' : 'retained-separate-gate-not-claimed-complete';
    const key = JSON.stringify([text, kind]);
    const item = gateCatalogue.get(key) ?? {text, kind, tasks: []}; item.tasks.push(task.taskId); gateCatalogue.set(key, item);
    return {text, kind, status};
  });
  tasks.push({taskId: task.taskId, manifest: relative, manifestSha256: hash(bytes), workSha256: hash(task.work),
    requiredChecksStatus, extraImplementationCriteria: extraCriteria,
    localReceiptPromotion: holds.length ? 'held-unmet-implementation-or-required-check' : 'eligible-local-development-only', holds,
    remainingGates: task.remainingGates, remainingGateReview: separateGates,
    historicalRemainingGates: task.historicalRemainingGates ?? [], nextAction: task.nextAction});
}
const result = {revision, sourceDigest, reviewedAt: new Date().toISOString(), manifestCount: tasks.length,
  localReceiptDefinition: 'Required checks passed for an identified source revision, independently of provider submission, approval or publication. Remaining gates and nextAction are retained verbatim.',
  wholeProjectGoalStatus: 'Not established by local development receipt promotion.',
  eligible: tasks.filter(task => task.localReceiptPromotion === 'eligible-local-development-only').length,
  held: tasks.filter(task => task.holds.length).map(task => ({taskId: task.taskId, reasons: task.holds})),
  prototypeStructuralReview: structuralReview, separateGateCatalogue: [...gateCatalogue.values()], tasks};
const output = path.join(path.dirname(path.resolve(root, process.argv[2])), `${sourceDigest}-acceptance.json`);
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
if (await developmentSourceDigest(root) !== sourceDigest) throw new Error('Source changed during acceptance review');
console.log(JSON.stringify({revision, sourceDigest, manifests: tasks.length, eligibleLocalReceipts: result.eligible,
  held: result.held.length, separateGateClauses: result.separateGateCatalogue.length, prototype: structuralReview.status,
  equivalentLines: structuralReview.equivalentLines, report: path.relative(root, output)}));
if (result.held.length) process.exitCode = 1;
