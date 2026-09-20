import React, { useEffect, useState } from "react";

import { DataAppShell } from "./DataAppShell.jsx";

// The protected runtime accepts authored content and reviewed data at its boundary.
// Neither the source-build wrapper nor the prebuilt browser bundle owns a second
// copy of the shell, its contexts, or the hosted permission/fetch behavior.
export function DataAppRuntime({
  reviewedSnapshot,
  DashboardContent,
  ReportContent,
  hosted = globalThis.location?.hostname.endsWith(".chatgpt.site") ?? false,
} = {}) {
  const monitoring = !hosted && globalThis.document?.querySelector('meta[name="data-app-monitoring"]')?.content === "cloud";
  const [snapshot, setSnapshot] = useState(hosted || monitoring ? null : reviewedSnapshot);
  const [presentationRecord, setPresentationRecord] = useState({ presentation: {}, revision: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!monitoring) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/snapshot", {cache: "no-store", signal: controller.signal});
        if (!response.ok) throw new Error("Automatic monitoring data is unavailable.");
        const next = await response.json();
        if (next.id !== reviewedSnapshot.id || !next.queries) throw new Error("Unexpected monitoring snapshot.");
        if (!controller.signal.aborted) { setSnapshot(next); setError(null); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause);
      } finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {clearInterval(timer); controller.abort();};
  }, [monitoring, reviewedSnapshot.id]);

  useEffect(() => {
    if (!hosted) return;
    Promise.all([fetch("/api/snapshot"), fetch("/api/presentation")])
      .then(async ([snapshotResponse, presentationResponse]) => {
        if (!snapshotResponse.ok) throw new Error("Data app snapshot is unavailable.");
        if (!presentationResponse.ok) throw new Error("Data app presentation is unavailable.");
        const [snapshotValue, record] = await Promise.all([snapshotResponse.json(), presentationResponse.json()]);
        setPresentationRecord(record);
        setSnapshot(snapshotValue);
      })
      .catch(setError);
  }, [hosted]);

  if (!snapshot) return <main className="page">{error?.message ?? "Loading Data app…"}</main>;
  const Content = snapshot.surface === "report" ? ReportContent : DashboardContent;
  return (
    <DataAppShell
      snapshot={snapshot}
      hosted={hosted}
      onSnapshotChange={setSnapshot}
      canEdit={!hosted || presentationRecord.canEdit === true}
      initialPresentation={presentationRecord.presentation}
      initialRevision={presentationRecord.revision}
    >
      {monitoring && error && <p role="status">Automatic refresh is unavailable. Showing the last loaded measurements.</p>}
      <Content />
    </DataAppShell>
  );
}
