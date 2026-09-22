import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeReleaseStatus, publishReleaseStatus} from './publish-release-status.mjs';
const reviewed = JSON.parse(await readFile(new URL('../../docs/reports/platform-release-readiness/src/data.json', import.meta.url), 'utf8'));
test('release refresh preserves newer measurements and removes mismatched game analytics', () => {
  const current = structuredClone(reviewed);
  current.queries.backend_deployment_metrics = {rows: [{requests: 912}]};
  current.queries.provider_daily_activity = {rows: [{dailyActiveUsers: 0}], source: {tables: ['wrong game']}};
  const result = mergeReleaseStatus(current, reviewed);
  assert.deepEqual(result.queries.backend_deployment_metrics, current.queries.backend_deployment_metrics);
  assert.deepEqual(result.queries.provider_daily_activity, reviewed.queries.provider_daily_activity);
  assert.throws(() => mergeReleaseStatus({...current, id: 'other'}, reviewed));
});
test('a concurrent collection causes a fresh read rather than overwriting its measurements', async () => {
  let reads = 0;
  const store = {read: async () => ({generation: String(++reads), data: {...reviewed, queries: {...reviewed.queries, backend_deployment_metrics: {rows: [{requests: reads}]}}}}),
    write: async (_name, data, generation) => {if (generation === '1') throw Object.assign(new Error('conflict'), {status: 412}); assert.equal(data.queries.backend_deployment_metrics.rows[0].requests, 2);}};
  await publishReleaseStatus(store, reviewed);
  assert.equal(reads, 2);
});
