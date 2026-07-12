import {useEffect, useMemo, useState} from "react";

type AssetMetric = {
  name: string;
  bytes: number;
};

type RouteRunMetric = {
  run: number;
  dclMs: number | null;
  loadMs: number | null;
  fcpMs: number | null;
  elapsedMs: number;
  requests: number;
  bytes: number;
};

type RouteMetric = {
  id: string;
  label: string;
  path: string;
  bytes: number;
  requests: number;
  dclMs: number | null;
  loadMs: number | null;
  fcpMs: number | null;
  elapsedMs: number;
  initialAssets: string[];
  runs: RouteRunMetric[];
};

type PerformanceSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  commit: string | null;
  budgets: {
    dclMs: number;
    fcpMs: number;
    initialBytes: number;
    requests: number;
  };
  build: {
    command: string;
    viteChunkWarning: boolean;
    sourcemapCount: number;
    topAssets: AssetMetric[];
  };
  routes: RouteMetric[];
};

const BASE_PATH = "/riddle-quest";
const snapshotUrl = `${BASE_PATH}/performance/latest.json`;

const formatBytes = (bytes: number): string => {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1000)} KB`;
};

const formatMs = (value: number | null): string => (value === null ? "n/a" : `${value} ms`);

const isRouteHealthy = (route: RouteMetric, snapshot: PerformanceSnapshot): boolean => {
  return (
    route.bytes <= snapshot.budgets.initialBytes &&
    route.requests <= snapshot.budgets.requests &&
    (route.dclMs ?? Number.POSITIVE_INFINITY) <= snapshot.budgets.dclMs &&
    (route.fcpMs ?? Number.POSITIVE_INFINITY) <= snapshot.budgets.fcpMs
  );
};

export function PerformanceDashboardApp() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(snapshotUrl, {cache: "no-store"})
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Performance snapshot returned ${response.status}.`);
        }
        return response.json() as Promise<PerformanceSnapshot>;
      })
      .then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load performance snapshot.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const healthyRoutes = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.routes.filter((route) => isRouteHealthy(route, snapshot)).length;
  }, [snapshot]);

  if (error) {
    return (
      <main className="perf-dashboard">
        <section className="perf-empty">
          <p className="eyebrow">Synthetic performance</p>
          <h1>Snapshot unavailable</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="perf-dashboard">
        <section className="perf-empty">
          <div className="loader"><i /><i /><i /></div>
          <p>Loading performance snapshot</p>
        </section>
      </main>
    );
  }

  return (
    <main className="perf-dashboard">
      <section className="perf-hero">
        <div>
          <p className="eyebrow">Synthetic performance</p>
          <h1>Riddle Quest Web Vitals</h1>
          <p>
            Last measured {new Intl.DateTimeFormat("en-GB", {dateStyle: "medium", timeStyle: "short"}).format(new Date(snapshot.generatedAt))}
          </p>
        </div>
        <div className="perf-score">
          <span>Routes in budget</span>
          <strong>{healthyRoutes}/{snapshot.routes.length}</strong>
        </div>
      </section>

      <section className="perf-grid">
        <MetricTile label="Chunk warning" value={snapshot.build.viteChunkWarning ? "Present" : "Clear"} tone={snapshot.build.viteChunkWarning ? "bad" : "good"} />
        <MetricTile label="Sourcemaps" value={String(snapshot.build.sourcemapCount)} tone={snapshot.build.sourcemapCount > 0 ? "bad" : "good"} />
        <MetricTile label="Byte budget" value={formatBytes(snapshot.budgets.initialBytes)} />
        <MetricTile label="Commit" value={snapshot.commit?.slice(0, 7) ?? "local"} />
      </section>

      <section className="perf-panel">
        <div className="perf-panel-head">
          <div>
            <p className="eyebrow">Route timings</p>
            <h2>Cold static loads</h2>
          </div>
          <span>{snapshot.source}</span>
        </div>
        <div className="perf-route-list">
          {snapshot.routes.map((route) => {
            const healthy = isRouteHealthy(route, snapshot);
            return (
              <article className="perf-route-card" key={route.id}>
                <div className="perf-route-title">
                  <div>
                    <h3>{route.label}</h3>
                    <code>{route.path}</code>
                  </div>
                  <span className={healthy ? "perf-pill good" : "perf-pill bad"}>{healthy ? "In budget" : "Watch"}</span>
                </div>
                <div className="perf-route-metrics">
                  <span><strong>{formatMs(route.fcpMs)}</strong>FCP</span>
                  <span><strong>{formatMs(route.dclMs)}</strong>DCL</span>
                  <span><strong>{formatBytes(route.bytes)}</strong>Bytes</span>
                  <span><strong>{route.requests}</strong>Requests</span>
                </div>
                <div className="perf-assets">
                  {route.initialAssets.slice(0, 8).map((asset) => <code key={asset}>{asset}</code>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="perf-panel">
        <div className="perf-panel-head">
          <div>
            <p className="eyebrow">Bundle surface</p>
            <h2>Largest emitted assets</h2>
          </div>
          <span>{snapshot.build.command}</span>
        </div>
        <div className="perf-asset-table">
          {snapshot.build.topAssets.map((asset) => (
            <div key={asset.name}>
              <code>{asset.name}</code>
              <span>{formatBytes(asset.bytes)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricTile({label, value, tone}: {label: string; value: string; tone?: "good" | "bad"}) {
  return (
    <article className={`perf-tile ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
