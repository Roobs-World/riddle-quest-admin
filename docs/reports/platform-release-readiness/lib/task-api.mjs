import {createHash} from 'node:crypto';

const origin = 'https://riddle-quest-release-dashboard.vercel.app';
const collections = ['projects', 'tasks', 'requirements', 'documents', 'coverage'];
const jsonSchema = {type: 'object', additionalProperties: true};
export function openApi(projectIds = ['riddle-quest', 'beehive']) {
  const paths = {};
  for (const collection of collections) {
    paths[`/api/v1/${collection}`] = {get: {operationId: `list_${collection}`, summary: `Read ${collection} from the consolidated project register`,
      parameters: ['project', 'status', 'kind', 'q', 'taskId'].map(name => ({name, in: 'query', schema: {type: 'string'}})).concat([
        {name: 'limit', in: 'query', schema: {type: 'integer', minimum: 1, maximum: 200, default: 50}},
        {name: 'offset', in: 'query', schema: {type: 'integer', minimum: 0, default: 0}},
      ]), responses: {'200': {description: 'Paged records with freshness, provenance and total count', content: {'application/json': {schema: jsonSchema}}}, '400': {description: 'Invalid parameter'}}}};
    if (['tasks', 'requirements', 'documents'].includes(collection)) paths[`/api/v1/${collection}/{id}`] = {get: {
      operationId: `get_${collection.slice(0,-1)}`, summary: `Read one ${collection.slice(0,-1)} with source references`,
      parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'string'}}], responses: {'200': {description: 'Record', content: {'application/json': {schema: jsonSchema}}}, '404': {description: 'Unknown ID'}}}};
  }
  paths['/api/v1/context'] = {get: {operationId: 'get_project_context', summary: 'Read the complete register, optionally restricted to one project',
    parameters: [{name: 'project', in: 'query', schema: {type: 'string', enum: projectIds}}],
    responses: {'200': {description: 'Full tasks, requirements, projects, source coverage and caveats', content: {'application/json': {schema: jsonSchema}}}}}};
  paths['/api/v1/export'] = {get: {operationId: 'download_full_register', summary: 'Download the complete unabridged JSON register', responses: {'302': {description: 'Redirect to the static snapshot export'}}}};
  paths['/api/v1/health'] = {get: {operationId: 'get_register_health', summary: 'Read snapshot freshness and collection counts', responses: {'200': {description: 'Snapshot metadata', content: {'application/json': {schema: jsonSchema}}}}}};
  return {openapi: '3.1.0', info: {title: 'Project tasks and requirements API', version: '1.0.0', description: 'Read-only source-backed register for the projects listed in this snapshot. States distinguish verified development, reported completion, pending checks and provider gates. Sync and redeploy to update the snapshot.'}, servers: [{url: origin}], paths};
}
function integer(params, name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const value = params.get(name);
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < (name === 'limit' ? 1 : 0) || Number(value) > maximum) throw new Error(`Invalid ${name}`);
  return Number(value);
}
export function createTaskApi(register) {
  if (register.schemaVersion !== '1.0' || !register.dashboardId || !collections.every(key => Array.isArray(register[key]))) throw new Error('Invalid task register');
  const allowedProjects = new Set(register.projects.map(p => p.id));
  return (req, res) => {
    const headers = {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'If-None-Match',
      'Access-Control-Expose-Headers': 'ETag, Last-Modified', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, max-age=0, must-revalidate', 'Last-Modified': new Date(register.generatedAt).toUTCString()};
    const send = (status, value, extra = {}) => {
      const body = value === undefined ? '' : JSON.stringify(value);
      const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
      if (status === 200 && req.headers?.['if-none-match'] === etag) {res.writeHead(304, {...headers, ETag: etag});return res.end();}
      res.writeHead(status, {...headers, ...(status === 200 ? {ETag: etag} : {'Cache-Control': 'no-store'}), ...extra});
      res.end(req.method === 'HEAD' ? '' : body);
    };
    if (req.method === 'OPTIONS') return send(204);
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, {error: 'Read-only API'}, {Allow: 'GET, HEAD, OPTIONS'});
    try {
      const url = new URL(req.url, origin), params = url.searchParams;
      const project = params.get('project');
      if (project && !allowedProjects.has(project)) return send(400, {error: 'Unknown project', projects: [...allowedProjects]});
      const meta = {schemaVersion: register.schemaVersion, dashboardId: register.dashboardId, generatedAt: register.generatedAt, digest: register.digest};
      if (url.pathname === '/api' || url.pathname === '/api/' || url.pathname === '/api/v1' || url.pathname === '/api/v1/') return send(200,
        {...meta, readOnly: true, openapi: `${origin}/api/openapi.json`, endpoints: [...collections.map(c => `/api/v1/${c}`), '/api/v1/context', '/api/v1/export', '/api/v1/health'], caveats: register.caveats});
      if (url.pathname === '/api/openapi.json') return send(200, openApi([...allowedProjects]));
      if (url.pathname === '/api/v1/health') return send(200, {...meta, status: 'ok', counts: Object.fromEntries(collections.map(c => [c, register[c].length])), caveats: register.caveats});
      if (url.pathname === '/api/v1/export') return send(302, undefined, {Location: '/task-register.json'});
      if (url.pathname === '/api/v1/context') {
        const context = {...register, tasks: register.tasks.map(({description, ...row}) => ({...row, detailsUrl: `/api/v1/tasks/${encodeURIComponent(row.id)}`})), taskDescriptions: 'Read full task descriptions from detailsUrl or /api/v1/export',
        ...(project ? {projects: register.projects.filter(r => r.id === project), ...Object.fromEntries(collections.filter(c => c !== 'projects').map(c => [c, (c === 'tasks' ? register.tasks.map(({description, ...row}) => ({...row, detailsUrl: `/api/v1/tasks/${encodeURIComponent(row.id)}`})) : register[c]).filter(r => r.project === project)]))} : {})};
        return send(200, context);
      }
      const match = /^\/api\/v1\/(projects|tasks|requirements|documents|coverage)(?:\/([^/]+))?\/?$/.exec(url.pathname);
      if (!match) return send(404, {error: 'Unknown endpoint'});
      const [, collection, encodedId] = match;
      let rows = register[collection];
      if (encodedId) {
        const id = decodeURIComponent(encodedId), row = rows.find(r => r.id === id && (!project || r.project === project));
        if (!row) return send(404, {error: 'Unknown record'});
        return send(200, {...meta, record: row, ...(collection === 'tasks' ? {requirements: register.requirements.filter(r => row.requirementIds.includes(r.id))} : {})});
      }
      if (project) rows = rows.filter(r => collection === 'projects' ? r.id === project : r.project === project);
      for (const key of ['status', 'kind']) if (params.has(key)) rows = rows.filter(r => r[key] === params.get(key));
      if (params.has('taskId')) rows = rows.filter(r => r.id === params.get('taskId') || r.taskIds?.includes(params.get('taskId')));
      const search = params.get('q')?.trim().toLowerCase();
      if (search && search.length > 500) return send(400, {error: 'Search query too long'});
      if (search) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search));
      const limit = integer(params, 'limit', 50, 200), offset = integer(params, 'offset', 0);
      const next = offset + limit < rows.length ? offset + limit : null;
      const nextUrl = new URL(url); if (next !== null) nextUrl.searchParams.set('offset', String(next));
      return send(200, {...meta, total: rows.length, limit, offset, next: next === null ? null : `${nextUrl.pathname}${nextUrl.search}`, records: rows.slice(offset, offset + limit)});
    } catch (error) {
      return send(400, {error: error instanceof URIError ? 'Invalid record ID' : error.message});
    }
  };
}
