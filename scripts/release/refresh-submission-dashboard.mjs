import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {applyReleaseScope} from './release-scope.mjs';

/** Keep provider receipt evidence separate from local packaging and frontend messages. */
export function applySubmissions(snapshot, ledger) {
  const results = ledger.results;
  if (!Array.isArray(results) || new Set(results.map(row => row.platform)).size !== results.length) throw new Error('Duplicate or invalid submission records');
  for (const row of results) {
    if (!['live', 'submitted', 'blocked'].includes(row.outcome) || !Number.isFinite(Date.parse(row.verifiedAt))) throw new Error('Invalid submission outcome/date');
    if (['live', 'submitted'].includes(row.outcome) && ![200, 201, 202].includes(row.httpStatus)) throw new Error('Server receipt required');
    if (row.outcome === 'live' && !row.listingUrl.startsWith('https://')) throw new Error('Live listing URL required');
  }
  const queries = structuredClone(snapshot.queries);
  queries.submission_activity = {rows: results, source: {
    label: 'Provider submission receipts and independently verified listings', retrievedAt: ledger.verifiedAt,
    tables: ['docs/evidence/submissions-2026-09-22.json', 'artifacts/submissions/2026-09-22/'],
    filters: ['Two listings verified live; four further submissions received. Review acceptance is not publication.',
      'Additional intake routes are recorded here without implying a new integrated platform build. Browser-only success messages without transport are blocked.'],
    metricDefinitions: [{label: 'Submission outcome', definition: 'Observed server acceptance plus confirmation, or an independently reachable listing. Local packaging alone does not qualify.', componentIds: ['submission-activity']}],
  }};
  for (const row of results) {
    for (const platform of queries.platform_status.rows.filter(p => p.platform === row.platform)) platform.releaseStatus = `${row.status}. ${row.nextStep}`;
    for (const candidate of queries.html5_distribution_candidates.rows.filter(p => p.platform === row.platform)) {
      candidate.submissionProgress = `${row.status}. ${row.evidence}`;
      candidate.nextGate = row.nextStep;
    }
    for (const link of queries.target_links.rows.filter(p => p.platform === row.platform)) {
      link.adminUrl = row.submissionUrl;
      link.gameUrl = row.listingUrl || row.gameUrl;
      link.gameLinkStatus = row.outcome === 'live' ? 'Verified live provider listing' : `Hosted game available; ${row.status.toLowerCase()}`;
    }
    for (const action of queries.manual_action_checklist.rows.filter(p => p.platform === row.platform)) {
      action.status = row.outcome === 'live' ? 'Complete' : row.outcome === 'submitted' ? 'Submitted' : 'Blocked';
      action.priority = row.outcome === 'live' ? 'Verified' : row.outcome === 'submitted' ? 'Awaiting provider' : 'Access or provider repair';
      action.action = row.nextStep;
      action.destination = row.listingUrl || row.submissionUrl;
    }
  }
  return applyReleaseScope({...snapshot, generatedAt: ledger.verifiedAt, queries});
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL('../../docs/reports/platform-release-readiness/src/data.json', import.meta.url);
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  const ledger = JSON.parse(await readFile(new URL('../../docs/evidence/submissions-2026-09-22.json', import.meta.url), 'utf8'));
  await writeFile(file, `${JSON.stringify(applySubmissions(snapshot, ledger), null, 2)}\n`);
  console.log(`Refreshed ${ledger.results.length} observed submission routes.`);
}
