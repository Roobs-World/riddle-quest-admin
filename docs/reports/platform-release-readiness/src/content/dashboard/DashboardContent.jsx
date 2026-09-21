import React, {useState} from "react";
import {DeploymentMonitoring, ProviderActivity} from "./DeploymentMonitoring.jsx";
import {BackendMonitoring} from "./BackendMonitoring.jsx";
import {DataComponent, MetricCard, Section, SectionHeader, useDataApp} from "../../data-app-public.jsx";
import {Badge, Button, Card, CardContent, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "./shadcn-ui.jsx";

function Status({children}) {
  const value = String(children);
  const tone = /blocked|prohibited|failed|rejected/iu.test(value)
    ? "critical"
    : /absent|unauthorized|no partner|not uploaded|pending|gated|candidate|partial|hold/iu.test(value)
    ? "attention"
    : /passed|implemented|deployed|testing|private testing/iu.test(value)
      ? "positive"
      : "neutral";
  return <Badge variant={tone} data-tone={tone}>{value}</Badge>;
}

function EvidenceTable({id, queryId, title, rows, columns}) {
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <div className={rows.length > 10 ? "evidence-table-frame evidence-table-frame--scroll" : "evidence-table-frame"}>
      <div className="evidence-table-frame__toolbar"><span>{rows.length} {rows.length === 1 ? "record" : "records"}</span><span>Scroll table to inspect all details</span></div>
      <Table className="integration-table">
        <TableHeader><TableRow>{columns.map(({key, label}) => <TableHead key={key}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.platform ?? row.service ?? row.check}>
          {columns.map(({key, status, link}) => <TableCell key={key}>{link && row[key]
            ? <Button><a href={row[key]} target="_blank" rel="noreferrer">Open</a></Button>
            : status ? <Status>{row[key]}</Status> : row[key]}</TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </DataComponent>;
}

function ReleaseQueueSummary({rows}) {
  const done = rows.filter(({status}) => /done|complete|verified/iu.test(status)).length;
  const blocked = rows.filter(({status}) => /blocked|hold/iu.test(status)).length;
  const remaining = Math.max(0, rows.length - done);
  const progress = rows.length ? (done / rows.length) * 100 : 0;
  return <DataComponent id="release-queue-summary" queryId="manual_action_checklist" title="Release action queue" kind="metric" variant="plain" displayRows={rows} sourceRows={rows}>
    <Card className="release-queue-card">
      <CardContent>
        <div className="release-queue-card__header">
          <div><p className="release-queue-card__eyebrow">Owner actions</p><p className="release-queue-card__value">{remaining} remaining</p></div>
          <div className="release-queue-card__badges"><Badge variant="positive">{done} complete</Badge><Badge variant="attention">{blocked} blocked or held</Badge></div>
        </div>
        <Progress value={progress} label="Manual release checklist completion" />
      </CardContent>
    </Card>
  </DataComponent>;
}

function OutreachEmail({rows}) {
  const [copied, setCopied] = useState(false);
  const draft = rows[0] ?? {};
  const email = `Subject: ${draft.subject ?? ""}\n\n${draft.body ?? ""}`;
  async function copyDraft() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    globalThis.setTimeout(() => setCopied(false), 2000);
  }
  return <DataComponent id="promotion-email-template" queryId="promotion_email_template" title="Reusable promotion email" kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <Card className="outreach-email-card">
      <CardContent>
        <div className="outreach-email-card__header">
          <div><p className="release-queue-card__eyebrow">Press and promotion pitch</p><p className="outreach-email-card__subject">{draft.subject}</p></div>
          <Button onClick={copyDraft}>{copied ? "Copied" : "Copy email"}</Button>
        </div>
        <pre className="outreach-email-card__body">{draft.body}</pre>
      </CardContent>
    </Card>
  </DataComponent>;
}

export function DashboardContent() {
  const {reviewedRows} = useDataApp();
  const platforms = reviewedRows("platform_status");
  const releases = reviewedRows("provider_release_evidence");
  const distributionCandidates = reviewedRows("html5_distribution_candidates");
  const releaseAutomation = reviewedRows("release_automation");
  const manualActions = reviewedRows("manual_action_checklist");
  const monetization = reviewedRows("monetization_readiness");
  const services = reviewedRows("service_status");
  const dashboardChecks = reviewedRows("dashboard_verification");
  const promotionOutreach = reviewedRows("promotion_outreach");
  const promotionEmail = reviewedRows("promotion_email_template");
  const integratedTargets = platforms.filter(({integration}) => integration.startsWith("Implemented")).length;
  const providerEnvironments = releases.filter(({state}) => /testing|deployed|accepted/iu.test(state)).length;
  const integratedServices = services.filter(({status}) => status === "Integrated").length;

  return <article className="integration-dashboard" aria-label="Riddle Quest integration and release dashboard">
    <nav className="dashboard-jump-nav" aria-label="Dashboard sections">
      <div className="dashboard-jump-nav__identity">
        <span className="dashboard-jump-nav__signal" aria-hidden="true" />
        <span>Release operations</span>
      </div>
      <div className="dashboard-jump-nav__links">
        <a href="#manual-action-checklist-title">Action queue</a>
        <a href="#platform-integration-title">Targets</a>
        <a href="#monetization-readiness-title">Monetization</a>
        <a href="#release-automation-title">Automation</a>
        <a href="#promotion-outreach-title">Outreach</a>
      </div>
    </nav>

    <section className="integration-metrics" aria-label="Integration summary">
      <MetricCard id="metric-targets" queryId="platform_status" sourceRows={platforms} title="Release targets" value={String(platforms.length)} description="Every intended target is represented." />
      <MetricCard id="metric-integrated" queryId="platform_status" sourceRows={platforms} title="Full provider adapters" value={`${integratedTargets}/${platforms.length}`} description="Jest, Facebook, Reddit, YouTube and Yahoo." />
      <MetricCard id="metric-builds" queryId="platform_status" sourceRows={platforms} title="Local validation" value={`${platforms.filter(({localValidation}) => /passed/iu.test(localValidation)).length}/${platforms.length}`} description="Isolated builds and artifact audits passed." />
      <MetricCard id="metric-provider-releases" queryId="provider_release_evidence" sourceRows={releases} title="Provider environments" value={String(providerEnvironments)} description="Jest accepted, Facebook Testing, Reddit private and Yahoo production." />
      <MetricCard id="metric-services" queryId="service_status" sourceRows={services} title="Operational services" value={`${integratedServices}/${services.length}`} description="Firebase, Sentry, Vercel and Stripe are integrated." />
    </section>
    <ReleaseQueueSummary rows={manualActions} />

    <Section>
      <SectionHeader id="manual-action-checklist-title" title="Your manual release checklist" />
      <EvidenceTable id="manual-action-checklist" queryId="manual_action_checklist" title="Account, portal and approval steps that require you" rows={manualActions} columns={[
        {key:"status",label:"Status",status:true}, {key:"priority",label:"Priority"},
        {key:"platform",label:"Platform"}, {key:"action",label:"What you need to do"},
        {key:"destination",label:"Portal",link:true}, {key:"unlocks",label:"Unlocks"},
      ]} />
    </Section>

    <Section>
      <SectionHeader id="platform-integration-title" title="Target integration matrix" />
      <EvidenceTable id="platform-status" queryId="platform_status" title="Capabilities and release state" rows={platforms} columns={[
        {key:"platform",label:"Target"}, {key:"integration",label:"Integration"},
        {key:"identityAndSaves",label:"Identity and saves"}, {key:"commerceAndSocial",label:"Commerce and social"},
        {key:"ads",label:"Ads"}, {key:"localValidation",label:"Local checks",status:true},
        {key:"releaseStatus",label:"Provider release"},
      ]} />
    </Section>

    <Section>
      <SectionHeader id="monetization-readiness-title" title="IAP and advertising by platform" />
      <EvidenceTable id="monetization-readiness" queryId="monetization_readiness" title="Implemented capabilities and provider gates" rows={monetization} columns={[
        {key:"platform",label:"Platform"}, {key:"iap",label:"In-app purchases"},
        {key:"ads",label:"Advertising"}, {key:"gate",label:"Remaining verification or provider gate"},
      ]} />
    </Section>

    <section className="integration-grid integration-grid--evidence">
      <Section>
        <SectionHeader id="provider-release-title" title="Provider release evidence" />
        <EvidenceTable id="provider-release-evidence" queryId="provider_release_evidence" title="Latest verified external state" rows={releases} columns={[
          {key:"platform",label:"Target"}, {key:"providerReference",label:"Provider reference"},
          {key:"artifact",label:"Output"}, {key:"state",label:"State",status:true},
          {key:"submissionProgress",label:"Submission progress"}, {key:"nextGate",label:"Next gate"},
        ]} />
      </Section>
      <Section>
        <SectionHeader id="html5-distribution-title" title="Additional HTML5 distribution" />
        <EvidenceTable id="html5-distribution-candidates" queryId="html5_distribution_candidates" title="Submission and integration progress" rows={distributionCandidates} columns={[
          {key:"platform",label:"Platform"}, {key:"releaseModel",label:"Release model"},
          {key:"integration",label:"Required integration"}, {key:"submissionProgress",label:"Submission progress"},
          {key:"nextGate",label:"Next gate"},
        ]} />
      </Section>
      <Section>
        <SectionHeader id="release-automation-title" title="Release automation" />
        <EvidenceTable id="release-automation" queryId="release_automation" title="Latest all-platform workflow receipt" rows={releaseAutomation} columns={[
          {key:"platform",label:"Scope"}, {key:"status",label:"Status",status:true},
          {key:"trigger",label:"Trigger"}, {key:"revision",label:"Revision"},
          {key:"completedAt",label:"Completed"}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section>
    </section>

    <section className="monitoring-stack" aria-label="Monitoring and activity">
      <BackendMonitoring />
      <DeploymentMonitoring />
      <ProviderActivity />
    </section>

    <Section>
      <SectionHeader id="promotion-outreach-title" title="Promotion outreach" />
      <OutreachEmail rows={promotionEmail} />
      <EvidenceTable id="promotion-outreach" queryId="promotion_outreach" title="HTML5 and mobile gaming outreach list" rows={promotionOutreach} columns={[
        {key:"priority",label:"Priority",status:true}, {key:"website",label:"Website"},
        {key:"audience",label:"Audience"}, {key:"route",label:"Best outreach route"},
        {key:"status",label:"Status",status:true}, {key:"contactUrl",label:"Contact",link:true},
        {key:"pitchAngle",label:"Suggested angle"},
      ]} />
    </Section>

    <section className="integration-grid integration-grid--compact">
      <Section>
        <SectionHeader id="service-status-title" title="Operational integrations" />
        <EvidenceTable id="service-status" queryId="service_status" title="Infrastructure and account integrations" rows={services} columns={[
          {key:"service",label:"Service"}, {key:"purpose",label:"Purpose"},
          {key:"status",label:"Status",status:true}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section>
      <Section>
        <SectionHeader id="dashboard-verification-title" title="Dashboard E2E verification" />
        <EvidenceTable id="dashboard-verification" queryId="dashboard_verification" title="Rendered dashboard checks" rows={dashboardChecks} columns={[
          {key:"check",label:"Check"}, {key:"viewport",label:"Viewport"},
          {key:"result",label:"Result",status:true}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section>
    </section>
  </article>;
}
