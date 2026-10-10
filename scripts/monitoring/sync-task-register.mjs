import {readFile, writeFile, readdir, stat, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyTaskResolutions} from './task-resolutions.mjs';

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, args) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), args[index + 1]]);
  return pairs;
}, []));
const riddle = options['riddle-root'] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hive = options['hive-root'] ?? path.resolve(riddle, '../BeeHive');
const output = options.output ?? path.join(riddle, 'docs/reports/platform-release-readiness');
const now = new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shorten = value => String(value).split(/(?<=[.!?])\s|\n/)[0].slice(0, 180);
const source = (project, file, line) => ({project, file, ...(line ? {line} : {})});
const safeCommand = value => value.replace(/(?:\/home\/[^\s:;]+\/\.nvm\/versions\/node\/[^\s:;]+\/bin)/g, '<node-bin>').replace(/\/home\/[^\s:;]+\/Documents\//g, '<workspace>/');
async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function files(directory, suffix) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (['reports', 'node_modules', '.git', 'agents'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file, suffix));
    else if (entry.name.endsWith(suffix)) result.push(file);
  }
  return result.sort();
}
const snapshotFile = path.join(output, 'src/data.json');
const snapshot = await json(snapshotFile);
if (snapshot.id !== '7677b77a-0b56-4194-a2e7-937aff8f27f7') throw new Error('Dashboard identity mismatch');
const tasks = [], requirements = [], documents = [], coverage = [];
const requirementsByIdentity = new Map();
function requirement(project, kind, text, origin, taskId, extra = {}) {
  const identity = JSON.stringify([project, kind, text, extra]);
  let row = requirementsByIdentity.get(identity);
  if (!row) {
    row = {id: `${project}:requirement:${hash(identity).slice(0, 16)}`, project, kind, text, taskIds: [], sources: [], ...extra};
    requirementsByIdentity.set(identity, row); requirements.push(row);
  }
  if (taskId && !row.taskIds.includes(taskId)) row.taskIds.push(taskId);
  if (!row.sources.some(s => JSON.stringify(s) === JSON.stringify(origin))) row.sources.push(origin);
  return row.id;
}
const receipts = [...(snapshot.queries.development_progress?.rows ?? [])];
for (const file of await files(path.join(riddle, 'artifacts/development-progress'), '.json')) {
  const record = await json(file), c = record.completion;
  if (!c || !c.requiredChecks?.length || !c.requiredChecks.every(id => c.checks?.some(x => x.id === id && x.status === 'passed'))) continue;
  for (const target of c.targets) {
    if (!receipts.some(x => x.taskId === c.taskId && x.target === target && x.completedAt === c.completedAt))
      receipts.push({...c, target, status: 'Development verified', checks: c.checks.map(x => `${x.id}: ${x.evidence}`).join('; '), remainingGates: c.remainingGates.join('; '), artifacts: c.artifacts?.filter(x => x.target === target).map(x => `${x.file}: ${x.sha256}`).join('; ') || 'No artifact claim'});
  }
}
for (const file of await files(path.join(riddle, 'docs/development-tasks'), '.json')) {
  const manifest = await json(file), id = `riddle-quest:${manifest.taskId}`;
  if (!manifest.taskId || !manifest.work || !Array.isArray(manifest.checks)) throw new Error(`Invalid task manifest: ${file}`);
  const origin = source('riddle-quest', path.relative(riddle, file));
  const matches = receipts.filter(x => x.taskId === manifest.taskId && x.work === manifest.work &&
    manifest.checks.every(check => typeof x.checks === 'string' ? x.checks.includes(`${check.id}:`) : x.checks?.some(c => c.id === check.id && c.status === 'passed')));
  const verifiedTargets = new Set(matches.map(x => x.target));
  const verified = manifest.targets.every(target => verifiedTargets.has(target));
  const reqs = [
    ...manifest.checks.map(c => requirement('riddle-quest', 'verification', c.id, origin, id, {command: safeCommand(`${c.executable} ${c.args.join(' ')}`)})),
    ...(manifest.remainingGates ?? []).map(g => requirement('riddle-quest', 'gate', g, origin, id)),
  ];
  tasks.push({id, project: 'riddle-quest', kind: 'development', title: shorten(manifest.work), description: manifest.work,
    status: verified ? 'Development verified' : 'Verification pending', targets: manifest.targets, nextAction: manifest.nextAction,
    requirementIds: reqs, remainingGates: manifest.remainingGates ?? [], sources: [origin],
    evidence: matches.map(x => ({target: x.target, completedAt: x.completedAt, revision: x.revision, sourceDigest: x.sourceDigest})),
    evidenceNote: verified ? 'Recorded checks match this manifest. This is historical development evidence; current-source and provider verification remain separate.' : 'No complete matching verification receipt. Source changes and focused checks do not establish completion.'});
}
for (const queryId of ['manual_action_checklist', 'promotion_outreach']) {
  for (const row of snapshot.queries[queryId]?.rows ?? []) {
    const key = row.platform ?? row.website;
    tasks.push({id: `riddle-quest:${queryId}:${slug(key)}:${hash(JSON.stringify([row.action ?? row.pitchAngle ?? key, row.unlocks ?? ''])).slice(0, 12)}`, project: 'riddle-quest', kind: queryId === 'manual_action_checklist' ? 'release' : 'outreach',
      title: key, description: row.action ?? row.pitchAngle, status: row.status ?? 'Pending', priority: row.priority, unlocks: row.unlocks,
      targets: [key], nextAction: row.action ?? row.route, destination: row.destination ?? row.contactUrl, requirementIds: [],
      sources: [source('riddle-quest', `dashboard:${queryId}`)], evidenceNote: 'Existing reviewed record retained; no new provider approval claim.'});
  }
}
for (const [project, root] of [['riddle-quest', riddle], ['beehive', hive]]) {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const changed = execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean).length;
  coverage.push({project, source: 'repository', revision, hasUncommittedChanges: changed > 0, retrievedAt: now, status: 'Read'});
  const markdown = [...await files(path.join(root, 'docs'), '.md')];
  try { await stat(path.join(root, 'README.md')); markdown.push(path.join(root, 'README.md')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const agents = path.join(root, 'AGENTS.md');
  try { await stat(agents); markdown.push(agents); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const file of markdown) {
    const relative = path.relative(root, file), text = await readFile(file, 'utf8'), lines = text.split('\n');
    let heading = '', inCode = false;
    for (const [index, line] of lines.entries()) {
      if (/^```/.test(line)) inCode = !inCode;
      if (inCode) continue;
      if (/^#+ /.test(line)) heading = line.replace(/^#+ /, '');
      const check = /^\s*[-*]\s+\[([ xX])\]\s+(.+)/.exec(line);
      const policy = relative === 'AGENTS.md' && /^- (.+)/.exec(line);
      if (policy) requirement(project, 'policy', policy[1], source(project, relative, index + 1));
      if (relative !== 'AGENTS.md' && !relative.startsWith('docs/evidence/') && !relative.startsWith('docs/funding/') && /\b(must|shall|required|never)\b/i.test(line) && line.trim() && !check) requirement(project, 'documented requirement', line.trim(), source(project, relative, index + 1));
      if (check) {
        const id = `${project}:checklist:${hash(`${relative}:${check[2]}`).slice(0, 16)}`;
        const origin = source(project, relative, index + 1);
        tasks.push({id, project, kind: 'checklist', title: shorten(check[2]), description: check[2], group: heading,
          status: check[1].trim() ? 'Reported complete' : 'Pending', nextAction: check[1].trim() ? 'Retain documented evidence; confirm current applicability before release.' : check[2],
          requirementIds: [requirement(project, 'acceptance', check[2], origin, id)], sources: [origin], evidenceNote: 'Status copied from the source checklist; checked boxes are not independent verification receipts.'});
      }
    }
    const reportDate = relative.match(/2026-10-\d{2}/)?.[0] ?? text.slice(0, 1000).match(/2026-10-\d{2}/)?.[0];
    if (project === 'riddle-quest' && relative.startsWith('docs/evidence/') && reportDate && reportDate >= '2026-10-02') {
      const id = `${project}:progress-report:${slug(relative)}`;
      tasks.push({id, project, kind: 'progress-report', title: lines.find(l => /^# /.test(l))?.slice(2) ?? path.basename(file, '.md'),
        description: text, status: 'Work reported', reportedAt: reportDate, sources: [source(project, relative)], requirementIds: [],
        nextAction: 'Reconcile this work report with the task manifest and required current-source verification gates.',
        evidenceNote: 'Recent repository progress report. Its claims are preserved as source-reported evidence, not promoted to a guarded completion receipt.'});
    }
    // Index requirement and progress documents without publishing unrelated funding/operational private prose.
    if (relative === 'AGENTS.md' || relative.startsWith('docs/adr/') || /architecture|implementation|readiness|release|HANDOFF|LMS-SETUP|CONTENT-QA|WEBSITE-TEXT/.test(path.basename(file)))
      documents.push({id: `${project}:document:${slug(relative)}`, project, title: lines.find(l => /^# /.test(l))?.slice(2) ?? relative,
        source: source(project, relative), sha256: hash(text), category: relative.includes('/evidence/') ? 'evidence' : 'requirements',
        // Full source is available in its repository. The register retains precise lineage and digest.
        references: tasks.filter(t => t.sources.some(s => s.project === project && s.file === relative)).map(t => t.id)});
  }
  const issueFile = options[project === 'riddle-quest' ? 'riddle-issues' : 'hive-issues'];
  const issues = issueFile ? await json(issueFile) : JSON.parse(execFileSync('gh', ['issue', 'list', '--repo', project === 'riddle-quest' ? 'Grindhead/riddle-quest' : 'Grindhead/the-hive', '--state', 'all', '--limit', '1000', '--json', 'number,title,body,labels,state,updatedAt,url'], {encoding: 'utf8'}));
  if (issues.length === 1000) throw new Error('Issue page limit reached; extend pagination before claiming full coverage');
  coverage.push({project, source: 'GitHub issues', status: 'Read', records: issues.length, retrievedAt: now});
  for (const issue of issues) tasks.push({id: `${project}:issue:${issue.number}`, project, kind: 'issue', title: issue.title, description: issue.body,
    status: issue.state === 'CLOSED' ? 'Reported complete' : 'Open', labels: issue.labels.map(x => x.name), updatedAt: issue.updatedAt,
    requirementIds: [], sources: [{project, url: issue.url}], nextAction: issue.state === 'CLOSED' ? 'Retain issue resolution' : 'Resolve the issue acceptance requirements'});
}
// BeeHive's documented work and actual health. Keep client decisions and production verification separate.
const hiveRows = [
  ['welcome-flow', 'Learner naming and direct career quiz', 'Implemented', 'Editable made-up bee names; Next starts the 15-question career quiz directly. Bees grow from answers and replay updates the same bee.', 'Confirm the live learner experience with client acceptance.', 'README.md'],
  ['lms', 'SCORM and Moodle/Totara setup', 'Implemented', 'SCORM 1.2 launcher and LMS setup guide are present; resume survives relaunch on the same device.', 'Complete the client LMS rollout using docs/LMS-SETUP.md.', 'docs/LMS-SETUP.md'],
  ['content-sheet', 'Website text from Google Sheets', 'Implemented', 'Learner, TV, admin and results wording can read through /api/content.', 'Confirm the client content sheet and refresh settings.', 'docs/WEBSITE-TEXT.md'],
  ['optional-ai', 'Optional AI agents in production', 'Awaiting configuration', 'Host bee, career coach, admin drafting and filler bees are implemented. Production health currently reports ai=false.', 'Decide whether to enable the optional agents and configure a key if approved.', 'docs/HANDOFF.md'],
  ['shared-limits', 'Shared server rate limits', 'Pending', 'Rate limits currently count per server instance.', 'Use a shared store if a hard cross-instance cap is required.', 'docs/HANDOFF.md'],
  ['retention', '12-month data retention purge', 'Manual operation', 'The documented 12-month purge is manual.', 'Run the documented purge on the agreed cadence or automate it.', 'docs/HANDOFF.md'],
  ['ownership', 'Factory International admin ownership', 'Pending confirmation', 'Handoff requests a client owner and a decision about the built-in developer owner.', 'Confirm client ownership and the approved owner list.', 'docs/HANDOFF.md'],
  ['last-owner', 'Prevent loss of the last admin owner', 'Pending', 'The handoff records that a sole owner can demote themselves.', 'Prevent removal or demotion of the final owner and verify recovery.', 'docs/HANDOFF.md'],
  ['deploy-wizard', 'Update the deployment wizard', 'Pending', 'The deployment wizard is documented as out of date.', 'Align scripts/deploy-wizard.sh with the current deployment and environment settings.', 'docs/HANDOFF.md'],
  ['career-copy', 'Client review of authored career scoring and copy', 'Awaiting client', 'Strength tags, pathway descriptions and Q15 answer E need client confirmation.', 'Review the authored additions with the client before changing approved wording.', 'docs/HANDOFF.md'],
  ['logo', 'Factory International logo and fonts', 'Implemented', 'README and current assets confirm the official logo and licensed fonts; the older missing-logo handoff note is stale.', 'Keep the current supplied logo and licensed fonts.', 'README.md'],
];
for (const [key, title, status, description, nextAction, file] of hiveRows) {
  const id = `beehive:${key}`, origin = source('beehive', file);
  tasks.push({id, project: 'beehive', kind: 'project', title, status, description, nextAction, sources: [origin],
    requirementIds: [requirement('beehive', 'acceptance', description, origin, id)], evidenceNote: 'Source-backed project status. Implementation does not establish client acceptance.'});
}
const qa = await readFile(path.join(hive, 'docs/CONTENT-QA.md'), 'utf8');
for (const match of qa.matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)) {
  const id = `beehive:content-qa:${match[1]}`;
  tasks.push({id, project: 'beehive', kind: 'content-review', title: match[2].trim(), status: 'Awaiting client', description: match[3].trim(), nextAction: match[4].trim(), requirementIds: [], sources: [source('beehive', 'docs/CONTENT-QA.md')], evidenceNote: 'A review suggestion, not an agreed content change.'});
}
const resolutionSummary = await applyTaskResolutions(tasks, hive);
coverage.push({project: 'beehive', source: 'verified task resolutions', retrievedAt: now, status: resolutionSummary.stale ? 'Reverification needed' : 'Read', records: resolutionSummary.records, stale: resolutionSummary.stale});
const health = options['hive-health'] ? await json(options['hive-health']) : await fetch('https://buzz-tv-six.vercel.app/api/health').then(r => {if (!r.ok) throw new Error('Hive health unavailable');return r.json();});
if (health.ai) {
  const ai = tasks.find(row => row.id === 'beehive:optional-ai');
  if (ai?.status === 'Blocked') Object.assign(ai, {status: 'Verification pending', description: 'Production has an AI key configured; optional feature behavior still needs verification.', nextAction: 'Verify host, coach, draft and AI bee behavior with the configured approved key'});
}
coverage.push({project: 'beehive', source: 'production health', retrievedAt: now, status: health.ok ? 'Healthy' : 'Unhealthy', storage: health.storage, ai: health.ai});
// Reviewed follow-ups remain in the existing dashboard data through every refresh.
const supplemental = snapshot.queries.supplemental_tasks?.rows ?? [];
for (const row of supplemental) {
  if (!row.id || !row.project || !row.title || !row.description || !row.status || !Array.isArray(row.requirements) || !row.sources?.length) throw new Error('Invalid supplemental task');
  const {requirements: texts, ...task} = row;
  tasks.push({...task, requirementIds: texts.map(text => requirement(row.project, 'acceptance', text, row.sources[0], row.id))});
}
for (const project of new Set(supplemental.map(row => row.project))) coverage.push({project, source: 'reviewed supplemental follow-ups', retrievedAt: now, status: 'Read', records: supplemental.filter(row => row.project === project).length});
const ids = tasks.map(x => x.id);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate task IDs: ' + [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].join(', '));
tasks.sort((a,b) => a.project.localeCompare(b.project) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
const projects = [
  {id: 'riddle-quest', name: 'Riddle Quest', repository: 'https://github.com/Grindhead/riddle-quest', taskCount: tasks.filter(x => x.project === 'riddle-quest').length},
  ...[...new Set(supplemental.map(row => row.project).filter(id => !['beehive', 'riddle-quest'].includes(id)))].map(id => ({id, name: id, taskCount: tasks.filter(row => row.project === id).length})),
  {id: 'beehive', name: 'BeeHive / The Hive', repository: 'https://github.com/Grindhead/the-hive', liveUrl: 'https://buzz-tv-six.vercel.app', taskCount: tasks.filter(x => x.project === 'beehive').length},
];
const register = {schemaVersion: '1.0', dashboardId: snapshot.id, generatedAt: now, projects, coverage, tasks, requirements, documents,
  caveats: ['Snapshot updated by dashboard:sync; this API is read-only and does not watch local workspaces.', 'Historical development receipts, source-reported completion, provider approval and publication are distinct.', 'Concurrent source edits may require a new sync. Repository paths and line numbers refer to the captured sources.', 'Coverage includes both primary repositories, task manifests, source Markdown checklists, reviewed release/outreach actions, GitHub issues and explicitly reviewed supplemental follow-ups. Other projects have only the stated supplemental coverage; other chats are outside this register.']};
register.digest = hash(JSON.stringify(register));
await mkdir(path.join(output, 'src'), {recursive: true});
await writeFile(path.join(output, 'src/task-register.json'), JSON.stringify(register, null, 2) + '\n');
const reviewed = (rows, label, componentIds) => ({rows, source: {label, retrievedAt: now, executedAt: now,
  tables: ['docs/development-tasks/*.json', 'artifacts/development-progress/*.json', 'repository Markdown checklists', 'GitHub issues', 'BeeHive/docs'],
  filters: register.caveats, metricDefinitions: [{label: 'Task state', definition: 'Exact source state. Development verified requires matching work and all checks/targets in recorded receipts; reported complete is source-reported only.', componentIds}]}});
snapshot.generatedAt = now;
snapshot.queries.task_register = reviewed(tasks.map(({description, ...row}) => ({...row, description, requirements: row.requirementIds.length, sourceReference: row.sources.map(s => s.file ? `${s.project}/${s.file}${s.line ? `:${s.line}` : ''}` : s.url).join('; ')})), 'Consolidated project task register', ['task-register']);
snapshot.queries.requirements_register = reviewed(requirements.map(row => ({...row, linkedTasks: row.taskIds.length, sourceReference: row.sources.map(s => `${s.project}/${s.file}${s.line ? `:${s.line}` : ''}`).join('; ')})), 'Requirements, acceptance gates and verification checks', ['requirements-register']);
snapshot.queries.task_source_coverage = reviewed(coverage, 'Task source coverage and freshness', ['task-source-coverage']);
await writeFile(snapshotFile, JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify({projects: projects.length, tasks: tasks.length, requirements: requirements.length, documents: documents.length, generatedAt: now, digest: register.digest}));
