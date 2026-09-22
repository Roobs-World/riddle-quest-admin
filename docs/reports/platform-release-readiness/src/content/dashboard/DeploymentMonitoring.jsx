import React from "react";
import {Chart, DataComponent, Filters, Section, SectionHeader, useDataApp, useSectionFilters} from "../../data-app-public.jsx";
import {coverage, measurement, ratio} from "./deployment-metrics.js";

const dimensions = ["platform", "deployment", "environment", "date"];
const identity = [
  {key: "platform", label: "Target"},
  {key: "deployment", label: "Deployment"},
  {key: "environment", label: "Environment"},
  {key: "date", label: "UTC day"},
];
const numeric = (key, label, unit = "") => ({key, label, numeric: true, render: (row) => measurement(row[key], unit)});
const rate = (a, b) => (row) => {
  const value = ratio(row[a], row[b]);
  return measurement(value == null ? null : value * 100, "%");
};

function MonitoringTable({id, title, scope, columns}) {
  const props = scope.componentProps("deployment_metrics", dimensions);
  return <DataComponent id={id} queryId="deployment_metrics" title={title} kind="table" variant="card" {...props}>
    <div className="integration-table-wrap">
      <table className="integration-table monitoring-table">
        <thead><tr>{columns.map((column) => <th key={column.key} data-numeric={column.numeric}>{column.label}</th>)}</tr></thead>
        <tbody>{props.displayRows.map((row) => <tr key={JSON.stringify(dimensions.map((key) => row[key]))}>
          {columns.map((column) => <td key={column.key} data-numeric={column.numeric}>{column.render ? column.render(row) : row[column.key] ?? "Unavailable"}</td>)}
        </tr>)}</tbody>
      </table>
      {!props.displayRows.length && <p>No measurements match these filters.</p>}
    </div>
  </DataComponent>;
}

export function DeploymentMonitoring() {
  const scope = useSectionFilters(dimensions.map((field) => ({
    id: `monitor-${field}`, label: identity.find((column) => column.key === field).label,
    field, defaultValue: "all", queryIds: ["deployment_metrics"],
  })), {}, {id: "deployment-monitoring"});
  return <Section>
    <SectionHeader id="deployment-monitoring-title" title="Deployment engagement and performance" filters={<Filters {...scope.filterProps} />} />
    <p className="monitoring-note">Provider report snapshots, grouped by deployment and UTC day. Unavailable values are not zero. Import reports to update this view; automatic collection is not connected.</p>
    <MonitoringTable id="deployment-engagement" title="Engagement by deployment" scope={scope} columns={[
      ...identity, numeric("activePlayers", "Active players"), numeric("sessions", "Sessions"),
      numeric("gamesStarted", "Games started"), numeric("gamesCompleted", "Games completed"),
      {key: "completionRate", label: "Completion rate", numeric: true, render: rate("gamesCompleted", "gamesStarted")},
      {key: "sessionDuration", label: "Avg engaged time", numeric: true, render: (row) => measurement(ratio(row.engagedSeconds, row.sessions), " s")},
    ]} />
    <MonitoringTable id="deployment-performance" title="Runtime performance by deployment" scope={scope} columns={[
      ...identity, numeric("loadP95Ms", "Launch to playable p95", " ms"), numeric("loadSamples", "Load samples"),
      numeric("errorSessions", "Sessions with errors"), numeric("observedSessions", "Monitored sessions"),
      {key: "errorRate", label: "Error-session rate", numeric: true, render: rate("errorSessions", "observedSessions")},
    ]} />
    <MonitoringTable id="deployment-coverage" title="Measurement coverage and freshness" scope={scope} columns={[
      ...identity, {key: "coverage", label: "Coverage", render: (row) => coverage(row)},
      {key: "collectedAt", label: "Collected at (UTC)"}, {key: "source", label: "Source"}, {key: "nextStep", label: "Follow-up"},
    ]} />
  </Section>;
}

export function ProviderActivity() {
  const {reviewedRows, chartProps, chartOverrides, snapshot} = useDataApp();
  const rows = reviewedRows("provider_daily_activity", ["platform", "date"]);
  const chart = chartOverrides["provider-daily-activity"] ?? {type: "line", x: "date", y: "dailyActiveUsers", stackable: false};
  return <Section>
    <SectionHeader id="provider-activity-title" title="Provider-level engagement" />
    <p className="monitoring-note">Jest collection: {snapshot.monitoringStatus?.jestStatus ?? "Snapshot only"}. Last provider read: {snapshot.queries.provider_daily_activity?.source.retrievedAt ?? "Unavailable for the current game"}.</p>
    <p className="monitoring-note">Jest reports game-wide activity without deployment attribution. These measurements are separate from the deployment filters above. Provider reporting timezone is unspecified; the current day is excluded.</p>
    <DataComponent id="provider-daily-activity" queryId="provider_daily_activity" title="Jest daily active users"
      variant="card" kind="chart" chart={chart} displayRows={rows} sourceRows={rows}>
      <Chart spec={chart} rows={rows} height={300} {...chartProps("provider-daily-activity")} />
    </DataComponent>
  </Section>;
}
