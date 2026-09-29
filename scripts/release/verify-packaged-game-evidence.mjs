#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {listHtml5DistributionDefinitions} from './package-html5-platform.mjs';
const report = JSON.parse(await readFile('artifacts/release-e2e/packaged-games.json', 'utf8'));
const expected = [...listHtml5DistributionDefinitions().map(row => row.target), 'microsoft-pwa', 'gamesnacks', 'netflix', 'yahoo'].sort();
if (JSON.stringify(report.results.map(row => row.target).sort()) !== JSON.stringify(expected) ||
    report.results.some(row => row.status !== 'passed')) throw new Error('Packaged browser verification is incomplete');
const archives = report.results.filter(row => row.artifact);
for (const row of archives) {
  const bytes = await readFile(row.artifact);
  if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error(`Changed tested artifact: ${row.target}`);
}
console.log(`${report.results.length} packaged browser flows passed; all ${archives.length} tested archives match their recorded SHA-256 digests.`);
