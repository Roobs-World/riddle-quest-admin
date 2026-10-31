import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {appendFile, copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHtml5HandoffPreparation} from '../../../scripts/release/html5-handoff-preparation.mjs';
import {releaseRegistry} from '../../../scripts/release/release-registry.mjs';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const execute = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceBefore = await developmentSourceDigest(root);
const {stdout} = await execute('git', ['rev-parse', 'HEAD'], {cwd: root});
const revision = stdout.trim();
const baseDirectory = path.join(root, 'artifacts/goal-completion-2026-10-24/riddle/neutral-handoffs');
const directory = path.join(baseDirectory, 'runs', `${revision.slice(0, 12)}-${sourceBefore.slice(0, 12)}-${Date.now()}`);
const priorDirectory = path.join(directory, 'prior');
await mkdir(priorDirectory, {recursive: true});
try {
  const previous = await readFile(path.join(baseDirectory, 'status.json'));
  await mkdir(path.join(baseDirectory, 'history'), {recursive: true});
  await writeFile(path.join(baseDirectory, 'history', `${hash(previous)}.json`), previous, {flag: 'wx'}).catch(error => {if (error.code !== 'EEXIST') throw error;});
} catch (error) {if (error.code !== 'ENOENT') throw error;}
const definitions = releaseRegistry.filter(row => row.delivery === 'neutral-html5');
const report = {revision, sourceBefore, startedAt: new Date().toISOString(), scope: 'Local current-source neutral handoff preparation only; no provider publication', evidenceDirectory: path.relative(root, directory), prior: [], commands: [], results: []};
const reportFile = path.join(directory, 'status.json');
const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
for (const definition of definitions) {
  const file = path.join(root, definition.artifact);
  const manifest = JSON.parse(await readFile(`${file}.manifest.json`, 'utf8'));
  const actual = hash(await readFile(file));
  if (manifest.sha256 !== actual) throw new Error(`Cannot archive inconsistent prior handoff ${definition.target}`);
  report.prior.push({target: definition.target, manifest, actualSha256: actual});
}
if (new Set(report.prior.map(row => row.actualSha256)).size !== 1) throw new Error('Prior archives are not identical; preserve each unique archive before refreshing');
await copyFile(path.join(root, definitions[0].artifact), path.join(priorDirectory, 'common-neutral.zip'));
await writeFile(path.join(priorDirectory, 'handoff-manifests.json'), JSON.stringify(report.prior, null, 2) + '\n');
await copyFile(path.join(root, 'build-html5.zip.source.json'), path.join(priorDirectory, 'source.json'));
await copyFile(path.join(root, 'artifacts/release-e2e/packaged-games.json'), path.join(priorDirectory, 'packaged-games.json'));
await save();
const log = path.join(directory, 'preparation.log');
const run = async (executable, args, options) => {
  const startedAt = new Date().toISOString();
  console.log(`Run ${executable} ${args.join(' ')}`);
  const result = await execute(executable, args, {...options, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000});
  await appendFile(log, `\nCommand ${executable} ${args.join(' ')} at ${startedAt}\n${result.stdout ?? ''}\n${result.stderr ?? ''}\n`);
  report.commands.push({executable, args, startedAt, completedAt: new Date().toISOString(), exitCode: 0});
  await save();
  return result;
};
const preparation = createHtml5HandoffPreparation({root, run});
const source = await preparation.prepare();
for (const definition of definitions) {
  const manifest = await preparation.handoff(definition);
  const actual = hash(await readFile(path.join(root, definition.artifact)));
  if (manifest.sourceRevision !== revision || manifest.sha256 !== actual || actual !== source.sha256) throw new Error(`Current handoff verification failed for ${definition.target}`);
  report.results.push({target: definition.target, artifact: definition.artifact, manifest: `${definition.artifact}.manifest.json`, sha256: actual, sourceRevision: manifest.sourceRevision, status: 'passed'});
  await save();
}
report.source = source;
report.sourceAfter = await developmentSourceDigest(root);
report.sourceStillMatches = report.sourceBefore === report.sourceAfter;
report.log = path.relative(root, log);
report.logSha256 = hash(await readFile(log));
report.completedAt = new Date().toISOString();
await save();
if (report.sourceStillMatches) await copyFile(reportFile, path.join(baseDirectory, 'status.json'));
console.log(JSON.stringify({handoffs: report.results.length, sourceBefore: report.sourceBefore, sourceAfter: report.sourceAfter, sourceStillMatches: report.sourceStillMatches, archiveSha256: source.sha256, report: path.relative(root, reportFile)}));
if (!report.sourceStillMatches) process.exitCode = 1;
