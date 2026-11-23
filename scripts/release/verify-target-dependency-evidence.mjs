#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webBuildFacts} from './release-registry.mjs';
import {assertTargetDependency, runtimePackage, targetDependencyEvidencePath} from '../../packages/web-game/webTargetDependencies.ts';
const root = fileURLToPath(new URL('../..', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [target, facts] of Object.entries(webBuildFacts)) {
  const directory = path.join(root, 'packages/web-game', facts.outputDirectory);
  const evidence = JSON.parse(await readFile(targetDependencyEvidencePath(target, directory), 'utf8'));
  if (evidence.target !== target || evidence.outputDirectory !== directory || !evidence.files?.length) throw new Error(`Incomplete ${target} inventory`);
  const actualFiles = (await readdir(directory, {recursive: true, withFileTypes: true})).filter(entry => entry.isFile())
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(evidence.files.map(row => row.file).sort())) throw new Error(`Changed ${target} file membership`);
  const chunks = new Map(evidence.chunks.map(chunk => [chunk.file, chunk.sha256]));
  for (const row of evidence.files) {
    if (row.file.endsWith('.map') || (/\.[cm]?js$/u.test(row.file) && !chunks.has(row.file))) throw new Error(`Untracked ${target} source: ${row.file}`);
    const hash = digest(await readFile(path.join(directory, row.file)));
    if (hash !== row.sha256 || (chunks.has(row.file) && chunks.get(row.file) !== hash)) throw new Error(`Changed ${target} bytes: ${row.file}`);
  }
  for (const module of evidence.modules) assertTargetDependency(target, path.resolve(root, module));
  const packages = [...new Set(evidence.modules.map(runtimePackage).filter(Boolean))].sort();
  if (JSON.stringify(packages) !== JSON.stringify(evidence.packages)) throw new Error(`Changed ${target} dependency declarations`);
  console.log(`${target}: verified ${actualFiles.length} files and ${packages.length} runtime packages`);
}
