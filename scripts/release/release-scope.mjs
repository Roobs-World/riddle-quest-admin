/** Historical PWA destinations retained for receipts, excluded from current development. */
export const excludedReleasePlatforms = Object.freeze(["Microsoft Store PWA", "PWA Directory", "PWAStore.io"]);

/** Applies the requested platform-only scope after evidence refresh without erasing receipts. */
export function applyReleaseScope(snapshot) {
  const queries = structuredClone(snapshot.queries);
  const reason = "Excluded from current scope: platform-specific HTML5 builds only; no standalone web/PWA builds.";
  for (const platform of excludedReleasePlatforms) {
    for (const row of queries.platform_status?.rows ?? []) {
      if (row.platform === platform) Object.assign(row, {localValidation: "Excluded from current build scope", releaseStatus: reason});
    }
    for (const row of queries.html5_distribution_candidates?.rows ?? []) {
      if (row.platform === platform) Object.assign(row, {submissionProgress: reason, nextGate: "No build or submission work scheduled"});
    }
    for (const row of queries.manual_action_checklist?.rows ?? []) {
      if (row.platform === platform) Object.assign(row, {status: "Excluded", priority: "Out of scope", action: reason});
    }
    for (const row of queries.target_links?.rows ?? []) {
      if (row.platform === platform) row.gameLinkStatus = "Historical link; excluded from current build scope";
    }
    for (const row of queries.monetization_readiness?.rows ?? []) {
      if (row.platform === platform) row.gate = reason;
    }
    for (const row of queries.release_automation?.rows ?? []) {
      if (row.platform === platform) row.status = "Excluded from current build scope; historical receipt retained";
    }
  }
  for (const key of ["platform_status", "html5_distribution_candidates", "manual_action_checklist", "target_links", "monetization_readiness", "release_automation"]) {
    const source = queries[key]?.source;
    if (!source) continue;
    source.filters ??= [];
    if (!source.filters.includes(reason)) source.filters.push(reason);
    source.tables ??= [];
    if (!source.tables.includes("scripts/release/release-scope.mjs")) source.tables.push("scripts/release/release-scope.mjs");
  }
  return {...snapshot, queries};
}
