#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile, rename, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {listPlatformReleasePlans} from './platform-releases.mjs';
import {listHtml5DistributionDefinitions} from './package-html5-platform.mjs';
import {expectedName} from './release-target-names.mjs';

const repository = fileURLToPath(new URL('../..', import.meta.url));

/** A packaged game is verified only when the tested digest matches the current bytes. */
export function packageEvidence(artifact, bytes, manifest, report) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (manifest.artifact !== artifact || manifest.sha256 !== digest) throw new Error('Manifest does not match archive');
  const result = report?.results?.find(row => row.artifact === artifact && row.sha256 === digest && row.status === 'passed');
  return {status: result ? 'Packaged gameplay verified; provider submission pending' : 'Packaged; gameplay verification pending',
    completedAt: result ? report.verifiedAt : null,
    evidence: `${artifact}; SHA-256 ${digest}. ${manifest.releaseBoundary ?? 'Provider publication is not established by packaging.'}`};
}

export async function recordReleaseAutomation(root = repository) {
  const snapshotPath = path.join(root, 'docs/reports/platform-release-readiness/src/data.json');
  const json = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
  const snapshot = await json('docs/reports/platform-release-readiness/src/data.json');
  const report = await json('artifacts/release-e2e/packaged-games.json').catch(() => null);
  const artifacts = new Map(listHtml5DistributionDefinitions().map(row => [row.target, row.artifact]));
  artifacts.set('gamesnacks', 'build-gamesnacks.zip');
  artifacts.set('microsoft-pwa', 'build-microsoft-pwa.zip');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const rows = [];
  for (const plan of listPlatformReleasePlans()) {
    const platform = expectedName(plan);
    let evidence;
    const artifact = artifacts.get(plan.target);
    if (artifact) {
      try {
        evidence = packageEvidence(artifact, await readFile(path.join(root, artifact)), await json(`${artifact}.manifest.json`), report);
      } catch {
        evidence = {status: 'Artifact missing or invalid', completedAt: null, evidence: `Rebuild and verify ${artifact}. ${plan.handoff}`};
      }
    } else {
      const provider = snapshot.queries.provider_release_evidence.rows.find(row => row.platform === platform);
      evidence = {status: provider?.state ?? 'Provider evidence required', completedAt: provider?.verifiedAt ?? null,
        evidence: provider ? `${provider.artifact}. ${provider.nextGate}` : plan.handoff};
    }
    rows.push({platform, trigger: process.env.GITHUB_EVENT_NAME || 'local', revision, ...evidence});
  }
  snapshot.generatedAt = new Date().toISOString();
  snapshot.queries.release_automation = {rows, source: {
    label: 'Artifact digests, packaged browser checks and separately reviewed provider receipts',
    retrievedAt: snapshot.generatedAt,
    tables: ['artifacts/release-e2e/packaged-games.json', 'build-*.manifest.json', 'provider_release_evidence'],
    filters: ['Packaging and gameplay checks do not establish provider integration, upload, review approval or publication. Missing verification dates remain unknown.'],
    metricDefinitions: [{label: 'Automation status', definition: 'Current archive digest matched to a successful browser test, or a separately reviewed provider record. Revision identifies this audit, not necessarily the provider artifact source.', componentIds: ['release-automation']}],
  }};
  const temporary = `${snapshotPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {flag: 'wx'});
  await rename(temporary, snapshotPath);
  console.log(`Recorded evidence for ${rows.length} executable targets.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await recordReleaseAutomation();
