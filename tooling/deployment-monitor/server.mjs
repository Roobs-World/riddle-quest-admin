import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {collectBackendSnapshot} from "./collector.mjs";
import {collectJestSnapshot} from "./jest-provider.mjs";
import {googleClient, snapshotStore} from "./google.mjs";

export function monitoringHandler({store, request, seed, html, project, now = () => new Date(), collectJest = collectJestSnapshot}) {
  let pending;
  const send = (res, status, value) => {
    res.writeHead(status, {"Content-Type": "application/json", "Cache-Control": "private, no-store"});
    res.end(JSON.stringify(value));
  };
  return async (req, res) => {
    const path = new URL(req.url, "http://internal").pathname;
    try {
      if (req.method === "GET" && path === "/") {
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex"});
        return res.end(html.replace("<head>", '<head><meta name="data-app-monitoring" content="cloud">'));
      }
      if (req.method === "GET" && path === "/api/snapshot") {
        const [record, status] = await Promise.all([store.read("snapshot.json"), store.read("status.json")]);
        const snapshot = record?.data ?? seed;
        return send(res, 200, {...snapshot, monitoringStatus: status?.data ?? {status: "Not run", lastSuccessAt: null}});
      }
      if (req.method === "POST" && path === "/api/collect") {
        // Cloud Run IAM authenticates callers before this handler. No public invoker grant.
        pending ??= (async () => {
          const previousLease = await store.read("collection-lease.json");
          if (previousLease?.data.expiresAt > now().getTime()) return {status: "Already running"};
          const owner = randomUUID();
          await store.write("collection-lease.json", {owner, expiresAt: now().getTime() + 300000}, previousLease?.generation ?? "0");
          try {
          const previous = await store.read("snapshot.json");
          let snapshot = await collectBackendSnapshot(previous?.data ?? seed, {request, project, now: now()});
          let jestStatus = "Failed";
          try {
            const result = await collectJest(snapshot, {store, now: now()});
            snapshot = result.snapshot;
            jestStatus = result.status;
          } catch { /* Keep the last good Jest report, visibly marked as failed. */ }
          snapshot.queries.monitoring_refresh.rows.push({collector: "Jest analytics", status: jestStatus,
            lastSuccessAt: snapshot.queries.provider_daily_activity?.source.retrievedAt ?? null});
          await store.write("snapshot.json", snapshot, previous?.generation ?? "0");
          const status = await store.read("status.json");
          const result = {status: "Succeeded", lastAttemptAt: now().toISOString(), lastSuccessAt: snapshot.generatedAt, jestStatus};
          await store.write("status.json", result, status?.generation ?? "0");
          return {...result, deployments: snapshot.queries.backend_deployment_metrics.rows.length};
          } finally {
            const lease = await store.read("collection-lease.json");
            if (lease?.data.owner === owner) await store.write("collection-lease.json", {owner, expiresAt: 0}, lease.generation);
          }
        })().finally(() => {pending = undefined;});
        return send(res, 200, await pending);
      }
      return send(res, 404, {error: "Not found"});
    } catch (error) {
      if (path === "/api/collect") {
        try {
          const previous = await store.read("status.json");
          await store.write("status.json", {status: "Failed", lastAttemptAt: now().toISOString(), lastSuccessAt: previous?.data.lastSuccessAt ?? null}, previous?.generation ?? "0");
        } catch { /* The non-2xx response also records failure in Scheduler. */ }
      }
      console.error(JSON.stringify({event: "monitoring_failure", path, status: error.status ?? 500}));
      return send(res, 502, {error: "Monitoring refresh failed; the last successful snapshot is retained."});
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const request = googleClient();
  const store = snapshotStore(request, process.env.MONITOR_BUCKET);
  const seed = JSON.parse(await readFile(new URL("./seed.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  createServer(monitoringHandler({store, request, seed, html, project: process.env.GOOGLE_CLOUD_PROJECT}))
    .listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
}
