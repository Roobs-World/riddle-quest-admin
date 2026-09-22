import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {googleClient, snapshotStore} from '../../tooling/deployment-monitor/google.mjs';
import {jestGame} from '../../tooling/deployment-monitor/jest-provider.mjs';

const releaseQueries = ['platform_status', 'provider_release_evidence', 'html5_distribution_candidates',
  'dashboard_verification', 'service_status', 'release_automation', 'manual_action_checklist',
  'monetization_readiness', 'target_links'];

/** Refresh release evidence without replacing cloud-collected measurements or presentation. */
export function mergeReleaseStatus(current, reviewed, now = new Date()) {
  if (!current.id || current.id !== reviewed.id) throw new Error('Dashboard identity mismatch');
  const queries = {...current.queries};
  for (const key of releaseQueries) {
    if (!Array.isArray(reviewed.queries[key]?.rows)) throw new Error(`Missing reviewed query: ${key}`);
    queries[key] = reviewed.queries[key];
  }
  const latestCoverage = new Map(reviewed.queries.deployment_metrics.rows.filter(row => row.date === 'Not reported').map(row => [row.platform, row]));
  queries.deployment_metrics = {...queries.deployment_metrics, rows: queries.deployment_metrics.rows.map(row =>
    row.date === 'Not reported' ? latestCoverage.get(row.platform) ?? row : row)};
  // Do not retain measurements from the previously misconfigured game.
  if (!queries.provider_daily_activity?.source?.tables?.some(table => table.includes(jestGame.gameId))) {
    queries.provider_daily_activity = reviewed.queries.provider_daily_activity;
  }
  return {...current, generatedAt: now.toISOString(), buildStatus: reviewed.buildStatus, queries};
}

export async function publishReleaseStatus(store, reviewed) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await store.read('snapshot.json');
    if (!current) throw new Error('Existing dashboard snapshot is required');
    const updated = mergeReleaseStatus(current.data, reviewed);
    try {
      await store.write('snapshot.json', updated, current.generation);
      return updated;
    } catch (error) {
      if (error.status !== 412 || attempt === 2) throw error;
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reviewed = JSON.parse(await readFile(new URL('../../docs/reports/platform-release-readiness/src/data.json', import.meta.url), 'utf8'));
  const accessToken = execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8'}).trim();
  const store = snapshotStore(googleClient({accessToken}), 'riddle-quest-monitoring-ec2b2');
  const updated = await publishReleaseStatus(store, reviewed);
  console.log(`Published ${updated.queries.platform_status.rows.length} release statuses; current backend and deployment measurements preserved.`);
}
