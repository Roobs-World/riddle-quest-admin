import React from "react";
import {DataComponent, MetricCard, Section, SectionHeader, useDataApp} from "../../data-app-public.jsx";

function Status({children}) {
  const value = String(children);
  const tone = /absent|unauthorized|no partner|not uploaded|pending|gated|candidate|partial/iu.test(value)
    ? "attention"
    : /passed|implemented|deployed|testing|private testing/iu.test(value)
      ? "positive"
      : "neutral";
  return <span className="integration-status" data-tone={tone}>{value}</span>;
}

function EvidenceTable({id, queryId, title, rows, columns}) {
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <div className="integration-table-wrap">
      <table className="integration-table">
        <thead><tr>{columns.map(({key, label}) => <th key={key}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.platform ?? row.service}>
          {columns.map(({key, status}) => <td key={key}>{status ? <Status>{row[key]}</Status> : row[key]}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </DataComponent>;
}

export function DashboardContent() {
  const {reviewedRows} = useDataApp();
  const platforms = reviewedRows("platform_status");
  const releases = reviewedRows("provider_release_evidence");
  const services = reviewedRows("service_status");
  const integratedTargets = platforms.filter(({integration}) => integration.startsWith("Implemented")).length;
  const providerEnvironments = releases.filter(({state}) => ["Testing", "Private testing", "Deployed"].includes(state)).length;
  const integratedServices = services.filter(({status}) => status === "Integrated").length;

  return <article className="integration-dashboard" aria-label="Riddle Quest integration and release dashboard">
    <section className="integration-metrics" aria-label="Integration summary">
      <MetricCard id="metric-targets" queryId="platform_status" sourceRows={platforms} title="Release targets" value={String(platforms.length)} description="Every intended target is represented." />
      <MetricCard id="metric-integrated" queryId="platform_status" sourceRows={platforms} title="Full provider adapters" value={`${integratedTargets}/${platforms.length}`} description="Jest, Facebook, Reddit and YouTube." />
      <MetricCard id="metric-builds" queryId="platform_status" sourceRows={platforms} title="Local validation" value={`${platforms.filter(({localValidation}) => localValidation === "Passed").length}/${platforms.length}`} description="Isolated builds and artifact audits passed." />
      <MetricCard id="metric-provider-releases" queryId="provider_release_evidence" sourceRows={releases} title="Provider environments" value={String(providerEnvironments)} description="Facebook Testing, Reddit private and Yahoo web." />
      <MetricCard id="metric-services" queryId="service_status" sourceRows={services} title="Operational services" value={`${integratedServices}/${services.length}`} description="Firebase, Sentry and Vercel are integrated." />
    </section>

    <Section>
      <SectionHeader id="platform-integration-title" title="Target integration matrix" />
      <EvidenceTable id="platform-status" queryId="platform_status" title="Capabilities and release state" rows={platforms} columns={[
        {key:"platform",label:"Target"}, {key:"integration",label:"Integration",status:true},
        {key:"identityAndSaves",label:"Identity and saves"}, {key:"commerceAndSocial",label:"Commerce and social"},
        {key:"ads",label:"Ads"}, {key:"localValidation",label:"Local checks",status:true},
        {key:"releaseStatus",label:"Provider release"},
      ]} />
    </Section>

    <section className="integration-grid">
      <Section>
        <SectionHeader id="provider-release-title" title="Provider release evidence" />
        <EvidenceTable id="provider-release-evidence" queryId="provider_release_evidence" title="Latest verified external state" rows={releases} columns={[
          {key:"platform",label:"Target"}, {key:"providerReference",label:"Provider reference"},
          {key:"state",label:"State",status:true}, {key:"nextGate",label:"Next gate"},
        ]} />
      </Section>
      <Section>
        <SectionHeader id="service-status-title" title="Operational integrations" />
        <EvidenceTable id="service-status" queryId="service_status" title="Infrastructure and account integrations" rows={services} columns={[
          {key:"service",label:"Service"}, {key:"purpose",label:"Purpose"},
          {key:"status",label:"Status",status:true}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section>
    </section>
  </article>;
}
