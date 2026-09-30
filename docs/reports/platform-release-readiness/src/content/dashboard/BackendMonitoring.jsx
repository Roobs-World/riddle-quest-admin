import React from "react";
import {DataComponent, DataTable, Filters, Section, SectionHeader, useDataApp, useSectionFilters} from "../../data-app-public.jsx";
import {measurement} from "./deployment-metrics.js";

export function BackendMonitoring() {
  const {snapshot} = useDataApp();
  const scope = useSectionFilters(["platform", "service", "deployment"].map((field) => ({
    id: `backend-${field}`, label: {platform: "Target", service: "Service", deployment: "Revision"}[field],
    field, defaultValue: "all", queryIds: ["backend_deployment_metrics"],
  })), {}, {id: "backend-monitoring"});
  if (!snapshot.queries.backend_deployment_metrics) return null;
  const props = scope.componentProps("backend_deployment_metrics", ["platform", "service", "deployment", "windowStart", "windowEnd"]);
  const status = snapshot.monitoringStatus;
  const stale = !status?.lastSuccessAt || Date.now() - Date.parse(status.lastSuccessAt) > 2 * 3600000;
  const columns = [
    ["platform", "Target"], ["service", "Backend service"], ["deployment", "Deployed revision"],
    ["reportStatus", "Report status"], ["windowEnd", "Window end (UTC)"],
    ["requests", "Requests", true], ["successfulRequests", "HTTP 2xx", true], ["clientErrors", "HTTP 4xx", true],
    ["serverErrors", "HTTP 5xx", true], ["latencyP95Ms", "Server latency p95 (ms)", true], ["latencySamples", "Latency samples", true],
  ];
  const row = props.displayRows[0];
  return <Section>
    <SectionHeader id="backend-monitoring-title" title="Automatic backend monitoring" filters={<Filters {...scope.filterProps} />} />
    <p className="monitoring-note" role="status">Refresh: {status?.status ?? "Snapshot"}{stale ? " · overdue or not yet verified" : ""}. Last successful collection: {status?.lastSuccessAt ?? "Unavailable"}.</p>
    <p className="monitoring-note">Observed backend traffic includes test probes and rejected requests. It is not a count of players or gameplay sessions. Server latency is separate from game launch time. Each row covers the 24 hours ending at its displayed window end; historical rows retain the last report for retired revisions. {!row && "No deployments match these filters."}</p>
    <DataComponent id="backend-deployment-metrics" queryId="backend_deployment_metrics" title="Requests and latency by deployed backend revision" kind="table" variant="card" {...props}>
      <div className="evidence-data-table" data-reviewed-rows>
        <DataTable rows={props.displayRows} label="Requests and latency by deployed backend revision" columns={columns.map(([key, label, numeric]) => ({
          key, label, renderCell: value => numeric ? measurement(value) : value,
        }))} />
      </div>
    </DataComponent>
  </Section>;
}
