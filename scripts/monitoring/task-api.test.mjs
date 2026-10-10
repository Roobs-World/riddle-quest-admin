import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createTaskApi, openApi} from '../../docs/reports/platform-release-readiness/lib/task-api.mjs';
const register = {schemaVersion: '1.0', dashboardId: 'preserved', generatedAt: '2026-10-10T09:00:00Z', digest: 'sample', caveats: ['Recorded completion is historical'],
  projects: [{id: 'beehive'}, {id: 'riddle-quest'}], tasks: [{id: 'beehive:one', project: 'beehive', status: 'Pending', kind: 'development', title: 'Owner safeguard', requirementIds: ['r1']}, {id: 'riddle-quest:two', project: 'riddle-quest', status: 'Development verified', kind: 'development', requirementIds: []}],
  requirements: [{id: 'r1', project: 'beehive', taskIds: ['beehive:one']}], documents: [], coverage: []};
test('read-only API supports project scope, exact details, requirements, paging, errors and caching', async t => {
  const server = createServer(createTaskApi(register)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => fetch(`${base}${url}`, options);
  const scoped = await (await request('/api/v1/tasks?project=beehive&status=Pending&q=owner')).json();
  assert.equal(scoped.total, 1); assert.equal(scoped.records[0].id, 'beehive:one');
  const page = await (await request('/api/v1/tasks?limit=1')).json(); assert.equal(page.records.length, 1); assert.ok(page.next);
  const second = await (await request(page.next)).json(); assert.equal(second.records[0].id, 'riddle-quest:two'); assert.equal(second.next, null);
  const detail = await (await request('/api/v1/tasks/beehive%3Aone')).json(); assert.equal(detail.requirements[0].id, 'r1');
  assert.equal((await request('/api/v1/tasks/beehive%3Aone?project=riddle-quest')).status, 404);
  const context = await (await request('/api/v1/context?project=beehive')).json(); assert.equal(context.tasks.length, 1); assert.equal(context.requirements.length, 1); assert.equal(context.projects.length, 1);
  for (const suffix of ['limit=0','limit=201','offset=-1','project=unknown','limit=1.5']) assert.equal((await request(`/api/v1/tasks?${suffix}`)).status, 400);
  assert.equal((await request('/api/v1/tasks/missing')).status, 404); assert.equal((await request('/api/v1/missing')).status, 404);
  assert.equal((await request('/api/v1/tasks', {method: 'POST'})).status, 405);
  assert.equal((await request('/api/v1/tasks', {method: 'OPTIONS'})).status, 204);
  const response = await request('/api/v1/tasks'); assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal((await request('/api/v1/tasks', {headers: {'If-None-Match': response.headers.get('etag')}})).status, 304);
  assert.equal(await (await request('/api/v1/tasks', {method: 'HEAD'})).text(), '');
  const download = await request('/api/v1/export', {redirect: 'manual'}); assert.equal(download.status, 302); assert.equal(download.headers.get('location'), '/task-register.json');
  assert.equal((await (await request('/api/openapi.json')).json()).openapi, '3.1.0');
  assert.equal((await (await request('/api/v1/health')).json()).counts.tasks, 2);
});
test('OpenAPI exposes only read operations', () => {
  for (const definition of Object.values(openApi().paths)) assert.deepEqual(Object.keys(definition), ['get']);
});
