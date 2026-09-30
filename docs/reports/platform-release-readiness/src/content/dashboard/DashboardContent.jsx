import React, {useState} from "react";
import {DeploymentMonitoring, ProviderActivity} from "./DeploymentMonitoring.jsx";
import {BackendMonitoring} from "./BackendMonitoring.jsx";
import {DataComponent, DataTable, Filters, MetricCard, Section, SectionHeader, useDataApp, useDashboardTabs, useSectionFilters} from "../../data-app-public.jsx";
import {Badge, Button, Progress} from "./shadcn-ui.jsx";
import {displayDate, releaseStateTone, summarizeActions} from "./release-ui.js";

export const releaseTabs = [
  {id: "dashboard", label: "Release actions", previousLabels: ["Dashboard"], filterIds: []},
  {id: "targets", label: "Targets", filterIds: []},
  {id: "monitoring", label: "Monitoring", filterIds: []},
  {id: "delivery", label: "Delivery", filterIds: []},
  {id: "outreach", label: "Outreach", filterIds: []},
];

function Status({children}) {
  const tone = releaseStateTone(children);
  return <Badge variant={tone} data-tone={tone}>{children ?? "Unavailable"}</Badge>;
}

function EvidenceTable({id, queryId, title, rows, columns, displayRows = rows, sourceRows = rows, ...scopeProps}) {
  const [details, setDetails] = useState(false);
  const hasDetails = columns.some(({detail}) => detail);
  const visibleColumns = columns.filter(({detail}) => details || !detail).map(({key, label, status, link, linkLabel}) => ({
    key, label,
    renderCell: (value, row) => {
      if (link) return value
        ? <Button asChild><a href={value} target="_blank" rel="noreferrer" aria-label={`${linkLabel ?? "Open"} ${row.platform ?? row.website ?? row.service ?? "destination"}`}>
          {linkLabel ?? "Open"}<span aria-hidden="true"> ↗</span>
        </a></Button>
        : <span className="evidence-unavailable">Unavailable</span>;
      if (status) return <Status>{value}</Status>;
      if (/^(verifiedAt|completedAt)$/u.test(key)) return <time dateTime={value}>{displayDate(value)}</time>;
      return <span className={/digest|revision|artifact/iu.test(key) ? "evidence-technical" : undefined}>{value ?? "Unavailable"}</span>;
    },
  }));
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" {...scopeProps} displayRows={displayRows} sourceRows={sourceRows}>
    <div className="evidence-data-table" data-reviewed-rows>
      <DataTable rows={displayRows} columns={visibleColumns} label={title} searchable={rows.length > 8}
        toolbarControls={hasDetails ? <Button aria-expanded={details} onClick={() => setDetails(!details)}>{details ? "Hide technical details" : "Show technical details"}</Button> : undefined} />
      {!displayRows.length && <p className="evidence-empty" role="status">No records match these filters. Choose All to broaden the selection.</p>}
    </div>
  </DataComponent>;
}

function ReleaseQueueSummary({rows, ...scopeProps}) {
  const {complete, blocked, held, remaining, now, progress} = summarizeActions(rows);
  return <DataComponent id="release-queue-summary" queryId="manual_action_checklist" title="Release action queue" kind="metric" variant="card" {...scopeProps} displayRows={rows} sourceRows={rows}>
    <div className="release-queue-card" data-reviewed-rows>
      <div className="release-queue-card__header">
        <div><p className="release-queue-card__eyebrow">Remaining actions</p><p className="release-queue-card__value">{remaining}<span> of {rows.length}</span></p></div>
        <dl className="release-queue-card__counts">
          <div><dt>Priority now</dt><dd>{now}</dd></div><div><dt>Blocked</dt><dd>{blocked}</dd></div>
          <div><dt>On hold</dt><dd>{held}</dd></div><div><dt>Complete</dt><dd>{complete}</dd></div>
        </dl>
      </div>
      <Progress value={progress} label="Manual release checklist completion" />
    </div>
  </DataComponent>;
}

function OutreachEmail({rows}) {
  const [copyStatus, setCopyStatus] = useState("");
  const draft = rows[0];
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopyStatus("Email copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the email below and copy it manually.");
    }
  }
  return <DataComponent id="promotion-email-template" queryId="promotion_email_template" title="Reusable promotion email" kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    {draft ? <div className="outreach-email-card" data-reviewed-rows>
      <div className="outreach-email-card__header">
        <div><p className="release-queue-card__eyebrow">Press and promotion pitch</p><p className="outreach-email-card__subject">{draft.subject}</p></div>
        <Button onClick={copyDraft}>{copyStatus === "Email copied." ? "Copy again" : "Copy email"}</Button>
      </div>
      <p className="copy-status" role="status">{copyStatus}</p>
      <pre className="outreach-email-card__body">{draft.body}</pre>
    </div> : <p className="evidence-empty">No email draft is available.</p>}
  </DataComponent>;
}

function ActionQueue() {
  const scope = useSectionFilters(["platform", "status", "priority"].map(field => ({
    id: `action-${field}`, label: {platform: "Platform", status: "Status", priority: "Priority"}[field],
    field, defaultValue: "all", queryIds: ["manual_action_checklist"],
  })), {}, {id: "release-actions"});
  const props = scope.componentProps("manual_action_checklist", ["platform", "status", "priority"]);
  const rows = props.displayRows;
  return (<Section>
      <SectionHeader id="manual-action-checklist-title" title="Your manual release checklist" filters={<Filters {...scope.filterProps} />} />
      <ReleaseQueueSummary rows={rows} {...props} />
      <EvidenceTable id="manual-action-checklist" queryId="manual_action_checklist" title="Account, portal and approval steps that require you" rows={rows} {...props} columns={[
        {key:"status",label:"Status",status:true}, {key:"priority",label:"Priority"},
        {key:"platform",label:"Platform"}, {key:"action",label:"What you need to do"},
        {key:"destination",label:"Portal",link:true}, {key:"unlocks",label:"Unlocks"},
      ]} />
    </Section>);
}

function TargetViews() {
  const scope = useSectionFilters([{id: "target-platform", label: "Platform", field: "platform", defaultValue: "all",
    queryIds: ["platform_status", "target_links", "monetization_readiness", "html5_distribution_candidates"]}], {}, {id: "target-readiness"});
  const platforms = scope.componentProps("platform_status", ["platform"]).displayRows;
  const targetLinks = scope.componentProps("target_links", ["platform"]).displayRows;
  const monetization = scope.componentProps("monetization_readiness", ["platform"]).displayRows;
  const distributionCandidates = scope.componentProps("html5_distribution_candidates", ["platform"]).displayRows;
  return <div className="dashboard-view"><Section>
      <SectionHeader id="platform-integration-title" title="Target integration matrix" filters={<Filters {...scope.filterProps} />} />
      <EvidenceTable id="target-links" queryId="target_links" title="Game and deployment links for every target" rows={targetLinks} {...scope.componentProps("target_links", ["platform"])} columns={[
        {key:"platform",label:"Target"}, {key:"gameLinkStatus",label:"Game link status",status:true},
        {key:"gameUrl",label:"Preview or live game",link:true,linkLabel:"Play"},
        {key:"adminUrl",label:"Deployment admin",link:true,linkLabel:"Manage"},
      ]} />
      <EvidenceTable id="platform-status" queryId="platform_status" title="Capabilities and release state" rows={platforms} {...scope.componentProps("platform_status", ["platform"])} columns={[
        {key:"platform",label:"Target"}, {key:"integration",label:"Integration"},
        {key:"identityAndSaves",label:"Identity and saves"}, {key:"commerceAndSocial",label:"Commerce and social"},
        {key:"ads",label:"Ads"}, {key:"localValidation",label:"Local checks",status:true},
        {key:"releaseStatus",label:"Provider release"},
      ]} />
    </Section>
<Section>
      <SectionHeader id="monetization-readiness-title" title="IAP and advertising by platform" />
      <EvidenceTable id="monetization-readiness" queryId="monetization_readiness" title="Implemented capabilities and provider gates" rows={monetization} {...scope.componentProps("monetization_readiness", ["platform"])} columns={[
        {key:"platform",label:"Platform"}, {key:"iap",label:"In-app purchases"},
        {key:"ads",label:"Advertising"}, {key:"gate",label:"Remaining verification or provider gate"},
      ]} />
    </Section>
<Section>
        <SectionHeader id="html5-distribution-title" title="Additional HTML5 distribution" />
        <EvidenceTable id="html5-distribution-candidates" queryId="html5_distribution_candidates" title="Submission and integration progress" rows={distributionCandidates} {...scope.componentProps("html5_distribution_candidates", ["platform"])} columns={[
          {key:"platform",label:"Platform"}, {key:"releaseModel",label:"Release model"},
          {key:"integration",label:"Required integration"}, {key:"submissionProgress",label:"Submission progress"},
          {key:"nextGate",label:"Next gate"},
        ]} />
      </Section></div>;
}

export function DashboardContent() {
  const {reviewedRows} = useDataApp();
  const {activeTabId} = useDashboardTabs(releaseTabs);
  const tab = releaseTabs.some(({id}) => id === activeTabId) ? activeTabId : "dashboard";
  const platforms = reviewedRows("platform_status");
  const releases = reviewedRows("provider_release_evidence");
  const submissions = reviewedRows("submission_activity");
  const releaseAutomation = reviewedRows("release_automation");
  const developmentProgress = reviewedRows("development_progress");
  const services = reviewedRows("service_status");
  const dashboardChecks = reviewedRows("dashboard_verification");
  const promotionOutreach = reviewedRows("promotion_outreach");
  const promotionEmail = reviewedRows("promotion_email_template");
  const integrated = platforms.filter(({integration}) => integration.startsWith("Implemented"));
  const validated = platforms.filter(({localValidation}) => /passed/iu.test(localValidation));
  const environments = releases.filter(({state}) => /testing|deployed|accepted/iu.test(state));
  const operational = services.filter(({status}) => status === "Integrated");

  return <article className="integration-dashboard" aria-label="Riddle Quest integration and release dashboard">
    {tab === "dashboard" && <div className="dashboard-view">
      <section className="integration-metrics" aria-label="Integration summary">
        <MetricCard id="metric-targets" queryId="platform_status" sourceRows={platforms} title="Release targets" value={String(platforms.length)} description="Targets represented in the reviewed release evidence." />
        <MetricCard id="metric-integrated" queryId="platform_status" sourceRows={platforms} title="Full provider adapters" value={`${integrated.length}/${platforms.length}`} description={integrated.map(({platform}) => platform).join(", ") || "No full provider adapters recorded."} />
        <MetricCard id="metric-builds" queryId="platform_status" sourceRows={platforms} title="Local validation" value={`${validated.length}/${platforms.length}`} description="Targets with a passed local build or validation; provider gates may remain." />
        <MetricCard id="metric-provider-releases" queryId="provider_release_evidence" sourceRows={releases} title="Provider environments" value={String(environments.length)} description="Recorded testing, deployed or accepted environments; activation may be unconfirmed." />
        <MetricCard id="metric-services" queryId="service_status" sourceRows={services} title="Operational services" value={`${operational.length}/${services.length}`} description={operational.map(({service}) => service).join(", ") || "No integrated services recorded."} />
      </section>
      <ActionQueue />
<Section>
      <SectionHeader id="submission-activity-title" title="Submission receipts and live listings" />
      <EvidenceTable id="submission-activity" queryId="submission_activity" title="Verified submission outcomes" rows={submissions} columns={[
        {key:"platform",label:"Platform"}, {key:"status",label:"Outcome",status:true},
        {key:"verifiedAt",label:"Verified (UTC)"}, {key:"evidence",label:"Receipt or blocker"},
        {key:"listingUrl",label:"Live listing",link:true,linkLabel:"Play"}, {key:"nextStep",label:"Next step"},
      ]} />
    </Section>
<Section>
        <SectionHeader id="provider-release-title" title="Provider release evidence" />
        <EvidenceTable id="provider-release-evidence" queryId="provider_release_evidence" title="Latest verified external state" rows={releases} columns={[
          {key:"platform",label:"Target"}, {key:"providerReference",label:"Provider reference"},
          {key:"artifact",label:"Output"}, {key:"state",label:"State",status:true},
          {key:"submissionProgress",label:"Submission progress"}, {key:"nextGate",label:"Next gate"},
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
        <SectionHeader id="dashboard-verification-title" title="Recorded dashboard verification" />
        <EvidenceTable id="dashboard-verification" queryId="dashboard_verification" title="Previously recorded rendering checks" rows={dashboardChecks} columns={[
          {key:"check",label:"Check"}, {key:"viewport",label:"Viewport"},
          {key:"result",label:"Result",status:true}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section>
    </section>
    </div>}
    {tab === "targets" && <TargetViews />}
    {tab === "monitoring" && <section className="monitoring-stack" aria-label="Monitoring and activity">
      <BackendMonitoring />
      <DeploymentMonitoring />
      <ProviderActivity />
    </section>}
    {tab === "delivery" && <div className="dashboard-view"><Section>
        <SectionHeader id="development-progress-title" title="Verified development progress" />
        <EvidenceTable id="development-progress" queryId="development_progress" title="Completed work and remaining submission gates" rows={developmentProgress} columns={[
          {key:"platform",label:"Platform"}, {key:"taskId",label:"Task"}, {key:"status",label:"Development",status:true},
          {key:"work",label:"Completed work"}, {key:"revision",label:"Base revision",detail:true}, {key:"sourceDigest",label:"Verified source digest",detail:true}, {key:"completedAt",label:"Verified (UTC)",detail:true},
          {key:"checks",label:"Checks",detail:true}, {key:"artifacts",label:"Artifact digests",detail:true},
          {key:"remainingGates",label:"Remaining gates"}, {key:"nextAction",label:"Next action"},
        ]} />
      </Section>
<Section>
        <SectionHeader id="release-automation-title" title="Release automation" />
        <EvidenceTable id="release-automation" queryId="release_automation" title="Latest all-platform workflow receipt" rows={releaseAutomation} columns={[
          {key:"platform",label:"Scope"}, {key:"status",label:"Status",status:true},
          {key:"trigger",label:"Trigger"}, {key:"revision",label:"Revision"},
          {key:"completedAt",label:"Completed"}, {key:"evidence",label:"Evidence"},
        ]} />
      </Section></div>}
    {tab === "outreach" && <div className="dashboard-view"><Section>
      <SectionHeader id="promotion-outreach-title" title="Promotion outreach" />
      <OutreachEmail rows={promotionEmail} />
      <EvidenceTable id="promotion-outreach" queryId="promotion_outreach" title="HTML5 and mobile gaming outreach list" rows={promotionOutreach} columns={[
        {key:"priority",label:"Priority",status:true}, {key:"website",label:"Website"},
        {key:"audience",label:"Audience"}, {key:"route",label:"Best outreach route"},
        {key:"status",label:"Status",status:true}, {key:"contactUrl",label:"Contact",link:true},
        {key:"pitchAngle",label:"Suggested angle"},
      ]} />
    </Section></div>}
  </article>;
}
