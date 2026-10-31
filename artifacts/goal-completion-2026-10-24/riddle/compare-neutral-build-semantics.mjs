import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readProtectedContent} from '../../../packages/core/src/contentProtection.ts';
import {developmentSourceDigest} from '../../../scripts/release/development-source-digest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputFile = path.resolve(root, process.argv[2] ?? 'artifacts/goal-completion-2026-10-24/riddle/neutral-handoffs/final-target-semantic-comparison.json');
if (!path.relative(root, outputFile).startsWith('artifacts/goal-completion-2026-10-24/riddle/neutral-handoffs/')) throw new Error('Comparison output must stay in neutral handoff evidence');
const sourceBefore = await developmentSourceDigest(root);
const temporary = await mkdtemp(path.join(tmpdir(), 'rq-neutral-semantic-comparison-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const content = JSON.parse(await readFile(path.join(root, 'packages/portal/src/playable/generated/youtube-content-v1.json'), 'utf8'));
async function files(directory, prefix = '') {
  const output = {};
  for (const entry of await readdir(path.join(directory, prefix), {withFileTypes: true})) {
    const file = path.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(output, await files(directory, file));
    else output[file] = await readFile(path.join(directory, file));
  }
  return output;
}
async function normalize(directory) {
  const originals = await files(directory), mapping = {}, hashes = {}, packs = [];
  for (const file of Object.keys(originals)) mapping[file] = file
    .replace(/^(assets\/playable-pack-[a-z]{2})-[^.]+\.js$/u, '$1.js')
    .replace(/^assets\/index-[^.]+\.js$/u, 'assets/index.js');
  for (const [file, bytes] of Object.entries(originals)) {
    let normalized = bytes;
    if (/\.(?:js|html|css|json)$/u.test(file)) {
      let text = bytes.toString('utf8');
      const locale = file.match(/^assets\/playable-pack-([a-z]{2})-[^.]+\.js$/u)?.[1];
      if (locale) {
        const match = text.match(/\{contentProtection:1,iv:`([a-f0-9]+)`,data:`([a-f0-9]+)`\}/u);
        if (!match) throw new Error(`Missing protected content envelope in ${file}`);
        const decoded = await readProtectedContent({contentProtection: 1, iv: match[1], data: match[2]});
        const actual = hash(JSON.stringify(decoded)), expected = hash(JSON.stringify(content.packs[locale]));
        if (actual !== expected) throw new Error(`Built locale ${locale} differs from current canonical source`);
        packs.push({locale, decodedSha256: actual, canonicalSourceMatches: true});
        text = text.replace(match[0], JSON.stringify({verifiedCanonicalContentSha256: actual}));
      }
      for (const [original, canonical] of Object.entries(mapping)) {
        text = text.replaceAll(original, canonical).replaceAll(path.basename(original), path.basename(canonical));
      }
      normalized = Buffer.from(text);
    }
    hashes[mapping[file]] = hash(normalized);
  }
  return {hashes, packs};
}
try {
  await promisify(execFile)('unzip', ['-q', path.join(root, 'build-html5.zip'), '-d', temporary]);
  const archive = await normalize(temporary), finalTarget = await normalize(path.join(root, 'builds/netflix'));
  const differences = [...new Set([...Object.keys(archive.hashes), ...Object.keys(finalTarget.hashes)])].filter(file => archive.hashes[file] !== finalTarget.hashes[file]);
  const sourceAfter = await developmentSourceDigest(root);
  const report = {verifiedAt: new Date().toISOString(), sourceBefore, sourceAfter, sourceStillMatches: sourceBefore === sourceAfter,
    archive: 'build-html5.zip', finalTarget: 'builds/netflix', archiveFiles: Object.keys(archive.hashes).length, finalTargetFiles: Object.keys(finalTarget.hashes).length,
    normalizedDifferences: differences, archiveLocalePacks: archive.packs, finalTargetLocalePacks: finalTarget.packs,
    normalization: 'Only randomized AES-GCM content envelopes and their resulting content-addressed asset filenames are replaced. Every decoded locale must match its current canonical source hash. Other runtime bytes remain unchanged.',
    status: differences.length || sourceBefore !== sourceAfter ? 'failed' : 'passed'};
  await writeFile(outputFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, sourceBefore, sourceAfter, archiveFiles: report.archiveFiles, finalTargetFiles: report.finalTargetFiles,
    archiveLocalePacks: archive.packs.length, finalTargetLocalePacks: finalTarget.packs.length, normalizedDifferences: differences}));
  if (report.status !== 'passed') process.exitCode = 1;
} finally {await rm(temporary, {recursive: true, force: true});}
