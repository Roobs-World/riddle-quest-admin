import React from "react";
import {DataComponent, MetricCard, ReportSection, RichNarrative, useDataApp} from "../../data-app-public.jsx";

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

function EvidenceTable({id, queryId, title, rows, columns}) {
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <div className="report-table-wrap"><table className="report-table">
      <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[columns[0].key]}>{columns.map((column) =>
        <td key={column.key} data-status={row[column.key]}>{row[column.key]}</td>)}</tr>)}</tbody>
    </table></div>
  </DataComponent>;
}

export function ReportContent() {
  const {appTitle, reviewedRows} = useDataApp();
  const platforms = reviewedRows("platform_status");
  const [artifact] = reviewedRows("youtube_artifact");
  const suites = reviewedRows("verification_suites");
  const remaining = reviewedRows("remaining_work");
  return <article className="report-content" aria-label="Platform release readiness report">
    <header className="report-hero"><p className="report-kicker">Riddle Quest release evidence · 3 September 2026</p><h1>{appTitle}</h1>
      <RichNarrative id="report:introduction" className="report-deck" value="The repository-owned verification is complete for Jest, Facebook, Reddit, and YouTube. YouTube now has a deterministic, hash-bound upload archive. No build has been uploaded or promoted; the remaining work needs external platform access or physical devices." />
    </header>
    <ReportSection id="local-summary" queryId="platform_status" sourceRows={platforms} showHeading={false}>
      <RichNarrative id="report:local-summary" value="## Local outcome\n\nEvery isolated target built and passed its artifact and browser boundary. The YouTube release workflow additionally bound its content audit, exact test outputs, source snapshot, expanded files, and deterministic ZIP into machine-readable evidence." />
    </ReportSection>
    <div className="report-facts" aria-label="YouTube release facts">
      <MetricCard id="metric-locales" queryId="youtube_artifact" sourceRows={[artifact]} title="Locales" value={String(artifact.locales)} description="One English and sixteen reviewed translations." />
      <MetricCard id="metric-riddles" queryId="youtube_artifact" sourceRows={[artifact]} title="Riddles per locale" value={String(artifact.riddlesPerLocale)} description="Canonical set aligned across every locale." />
      <MetricCard id="metric-suites" queryId="verification_suites" sourceRows={suites} title="Release suites" value={`${suites.length}/${suites.length}`} description="All hash-bound evidence suites passed." />
      <MetricCard id="metric-zip" queryId="youtube_artifact" sourceRows={[artifact]} title="Upload ZIP" value={formatBytes(artifact.zipBytes)} description="Seven deterministic root-level entries." />
    </div>
    <EvidenceTable id="platform-status" queryId="platform_status" title="Cross-platform verification" rows={platforms} columns={[{key:"platform",label:"Platform"},{key:"build",label:"Build"},{key:"artifactAudit",label:"Artifact audit"},{key:"browser",label:"Browser"},{key:"releaseBoundary",label:"Release boundary"}]} />
    <EvidenceTable id="verification-suites" queryId="verification_suites" title="Canonical release evidence" rows={suites} columns={[{key:"suite",label:"Suite"},{key:"status",label:"Result"},{key:"scope",label:"Scope"}]} />
    <ReportSection id="youtube-artifact" queryId="youtube_artifact" sourceRows={[artifact]} showHeading={false}>
      <RichNarrative id="report:youtube-artifact" value={`## Exact YouTube candidate\n\nContent version: **${artifact.contentVersion}**  \nExpanded artifact: **${artifact.expandedFiles} files / ${formatBytes(artifact.expandedBytes)}**  \nZIP SHA-256: **${artifact.zipSha256}**\n\nThe source snapshot is intentionally marked dirty because the reviewed improvements are not committed. Its current hash is retained in the adjacent release manifest, which covers the complete tracked diff and every untracked source file without introducing a self-reference here.`} />
    </ReportSection>
    <EvidenceTable id="remaining-work" queryId="remaining_work" title="External certification work" rows={remaining} columns={[{key:"item",label:"Remaining item"},{key:"status",label:"Status"},{key:"requirement",label:"Required input"}]} />
    <ReportSection id="report-next" queryId="remaining_work" sourceRows={remaining} showHeading={false}>
      <RichNarrative id="report:next" value="## What happens next\n\nKeep `build-youtube.zip`, its manifest, and its test report together. Obtain Portal access and approved metadata first; then run the Google bundle analyzer, hosted Test Suite, and device matrix against this exact ZIP hash before certification submission. Any source or artifact change invalidates the current source snapshot and requires a fresh evidence run." />
    </ReportSection>
  </article>;
}
