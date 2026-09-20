const ownService = "riddle-quest-monitoring";
const targetFor = (service) => ["facebook", "jest", "reddit", "yahoo"].find((target) => service.includes(target));
const targetNames = {facebook: "Facebook", jest: "Jest", reddit: "Reddit", yahoo: "Yahoo"};

export function aggregateBackendRequests(entries, services, {start, end}) {
  const groups = new Map();
  const cell = (service, revision) => {
    const key = JSON.stringify([service, revision]);
    if (!groups.has(key)) groups.set(key, {
      platform: targetNames[targetFor(service)] ?? "Shared backend", service, deployment: revision,
      windowStart: start, windowEnd: end, requests: 0, successfulRequests: 0,
      clientErrors: 0, serverErrors: 0, latencySamples: 0, latencies: [],
    });
    return groups.get(key);
  };
  for (const service of services) {
    const name = service.name?.split("/").at(-1);
    const revision = service.latestReadyRevision?.split("/").at(-1);
    if (name && revision && name !== ownService) cell(name, revision);
  }
  const seen = new Set();
  for (const entry of entries) {
    const {service_name: service, revision_name: revision} = entry.resource?.labels ?? {};
    const status = entry.httpRequest?.status;
    const timestamp = Date.parse(entry.timestamp);
    if (!service || !revision || service === ownService || !Number.isInteger(status)
      || !Number.isFinite(timestamp) || timestamp < Date.parse(start) || timestamp >= Date.parse(end)) continue;
    const id = entry.insertId ? JSON.stringify([service, revision, entry.timestamp, entry.insertId]) : null;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const row = cell(service, revision);
    row.requests++;
    if (status >= 200 && status < 300) row.successfulRequests++;
    if (status >= 400 && status < 500) row.clientErrors++;
    if (status >= 500) row.serverErrors++;
    const duration = /^(\d+(?:\.\d+)?)s$/.exec(entry.httpRequest.latency ?? "");
    if (duration && Number.isFinite(Number(duration[1]))) row.latencies.push(Number(duration[1]) * 1000);
  }
  return [...groups.values()].map(({latencies, ...row}) => {
    latencies.sort((a, b) => a - b);
    return {...row, latencySamples: latencies.length,
      latencyP95Ms: latencies.length ? latencies[Math.ceil(latencies.length * .95) - 1] : null};
  }).sort((a, b) => a.platform.localeCompare(b.platform) || a.service.localeCompare(b.service) || a.deployment.localeCompare(b.deployment));
}

async function allPages(request, path, body, field, limit = 100) {
  const rows = [];
  const seenTokens = new Set();
  let pageToken;
  for (let page = 0; page < limit; page++) {
    const result = await request(path, {...body, ...(pageToken ? {pageToken} : {})});
    if (result[field] !== undefined && !Array.isArray(result[field])) throw new Error("Invalid provider page");
    rows.push(...(result[field] ?? []));
    if (!result.nextPageToken) return rows;
    if (seenTokens.has(result.nextPageToken)) throw new Error("Provider pagination repeated a cursor");
    seenTokens.add(result.nextPageToken);
    pageToken = result.nextPageToken;
  }
  throw new Error("Provider pagination exceeded the complete-report limit");
}

export async function collectBackendSnapshot(snapshot, {request, project, region = "us-central1", now = new Date()}) {
  const end = now.toISOString();
  const start = new Date(now.getTime() - 86400000).toISOString();
  const [entries, services] = await Promise.all([
    allPages(request, "https://logging.googleapis.com/v2/entries:list?fields=entries(insertId,timestamp,resource/labels,httpRequest/status,httpRequest/latency),nextPageToken", {
      resourceNames: [`projects/${project}`],
      filter: `resource.type="cloud_run_revision" AND logName="projects/${project}/logs/run.googleapis.com%2Frequests" AND timestamp>="${start}" AND timestamp<"${end}"`,
      orderBy: "timestamp desc", pageSize: 1000,
    }, "entries"),
    allPages(request, `https://run.googleapis.com/v2/projects/${project}/locations/${region}/services`, {pageSize: 100}, "services"),
  ]);
  const current = aggregateBackendRequests(entries, services, {start, end});
  const identity = (row) => JSON.stringify([row.service, row.deployment]);
  const observed = new Set(current.map(identity));
  // Keep the last observed report for retired revisions. Its original window is
  // retained, so historical traffic cannot masquerade as a current zero or count.
  const history = (snapshot.queries.backend_deployment_metrics?.rows ?? [])
    .filter((row) => !observed.has(identity(row)))
    .map((row) => ({...row, reportStatus: "Historical"}));
  const rows = [...current.map((row) => ({...row, reportStatus: "Current window"})), ...history];
  return {...snapshot, generatedAt: end, queries: {...snapshot.queries,
    backend_deployment_metrics: {rows, source: {
      label: "Google Cloud Logging request logs and Cloud Run deployment inventory",
      retrievedAt: end, tables: [`projects/${project}/logs/run.googleapis.com%2Frequests`, `projects/${project}/locations/${region}/services`],
      filters: ["Rolling 24-hour window. All pages read before publication; failed or truncated reads retain the last successful snapshot.",
        "Includes development probes, rejected requests and OPTIONS traffic. Request counts are not players, sessions or completed games.",
        "Each current ready backend revision is represented even when no request logs were observed. Older revisions with traffic remain visible.",
        "Retired revisions retain their last observed reporting window and are labelled Historical. Their values are not current-window traffic.",
        "Latency is server request latency, not game launch-to-playable. Shared endpoints are not attributed to a client target."],
      metricDefinitions: [{label: "Backend traffic and performance", definition: "Requests count observed HTTP request logs per service/revision. Successful requests are HTTP 2xx; client errors 4xx; server errors 5xx. p95 is nearest-rank over latency samples from this same group. No samples means unavailable.", componentIds: ["backend-deployment-metrics"]}],
    }},
    monitoring_refresh: {rows: [{collector: "Cloud Logging", status: "Succeeded", lastSuccessAt: end, windowStart: start, windowEnd: end, deployments: rows.length}], source: {
      label: "Automatic collector execution", retrievedAt: end,
      metricDefinitions: [{label: "Refresh status", definition: "Only updated after complete provider retrieval and durable snapshot publication. The browser checks for updated snapshots every minute.", componentIds: ["monitoring-refresh"]}],
    }},
  }};
}
