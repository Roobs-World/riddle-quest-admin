import {readFile, writeFile, rename} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {metricFields} from "../../docs/reports/platform-release-readiness/src/content/dashboard/deployment-metrics.js";

const targets = new Set(["Jest", "Facebook", "Reddit", "YouTube", "Netflix", "Yahoo"]);
const fields = ["platform", "deployment", "environment", "date", "collectedAt", "source", "nextStep", ...metricFields];
const key = (row) => JSON.stringify([row.platform, row.deployment, row.environment, row.date]);
const deploymentKey = (row) => JSON.stringify([row.platform, row.deployment, row.environment]);

/** Validate provider aggregates before they can enter the reviewed snapshot. */
export function validateMeasurement(row, now = Date.now()) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Expected a measurement object");
  if (Object.keys(row).some((field) => !fields.includes(field))) throw new Error("Unknown measurement field");
  if (!targets.has(row.platform)) throw new Error("Unknown target");
  for (const field of ["deployment", "environment", "source"]) {
    if (typeof row[field] !== "string" || !row[field].trim() || row[field].length > 500) throw new Error(`Invalid ${field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date) throw new Error("Invalid UTC day");
  const end = Date.parse(row.date) + 86400000;
  if (end > now) throw new Error("Only completed UTC days may be imported");
  if (typeof row.collectedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(row.collectedAt) || !Number.isFinite(Date.parse(row.collectedAt)) || Date.parse(row.collectedAt) < end || Date.parse(row.collectedAt) > now) throw new Error("Invalid collection timestamp");
  const result = Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
  for (const field of metricFields) {
    const value = result[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (!['engagedSeconds', 'loadP95Ms'].includes(field) && !Number.isSafeInteger(value)))) throw new Error(`Invalid ${field}`);
  }
  if (metricFields.every((field) => result[field] === null)) throw new Error("Report contains no measurements");
  for (const [part, total] of [["gamesCompleted", "gamesStarted"], ["errorSessions", "observedSessions"], ["activePlayers", "sessions"]]) {
    if (result[part] !== null && result[total] !== null && result[part] > result[total]) throw new Error(`${part} exceeds ${total}`);
  }
  if (result.loadP95Ms !== null && !(result.loadSamples > 0)) throw new Error("Load percentile requires positive sample count");
  if (result.engagedSeconds > 0 && result.sessions === 0) throw new Error("Engaged time requires sessions");
  if (result.nextStep !== null && (typeof result.nextStep !== "string" || result.nextStep.length > 500)) throw new Error("Invalid follow-up");
  result.nextStep ??= "Review coverage and refresh after the next completed UTC day.";
  return result;
}

/** Upsert daily measurements without dropping other deployments or their history. */
export function mergeMeasurements(snapshot, incoming, now = Date.now()) {
  if (!Array.isArray(incoming) || !incoming.length) throw new Error("Expected a nonempty array of provider measurements");
  const validated = incoming.map((row) => validateMeasurement(row, now));
  if (new Set(validated.map(key)).size !== validated.length) throw new Error("Duplicate deployment/day in import");
  const query = snapshot.queries.deployment_metrics;
  if (!query) throw new Error("Dashboard monitoring query is missing");
  const covered = new Set(validated.map(deploymentKey));
  const rows = new Map(query.rows.filter((row) => row.date !== "Not reported" || !covered.has(deploymentKey(row))).map((row) => [key(row), row]));
  for (const row of validated) {
    const previous = rows.get(key(row));
    if (previous?.collectedAt && Date.parse(previous.collectedAt) > Date.parse(row.collectedAt)) throw new Error("Import would replace newer evidence");
    rows.set(key(row), row);
  }
  return {...snapshot, generatedAt: new Date(now).toISOString(), queries: {...snapshot.queries,
    deployment_metrics: {...query, rows: [...rows.values()].sort((a, b) => key(a).localeCompare(key(b))), source: {...query.source,
      filters: query.source.filters.filter((value) => !value.startsWith("No engagement or performance measurements")),
    }},
  }};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, destination = "docs/reports/platform-release-readiness/src/data.json"] = process.argv.slice(2);
  if (!input) throw new Error("Usage: node scripts/monitoring/import-deployment-metrics.mjs <reviewed-report.json> [snapshot.json]");
  const snapshot = JSON.parse(await readFile(destination, "utf8"));
  const updated = mergeMeasurements(snapshot, JSON.parse(await readFile(input, "utf8")));
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, {flag: "wx"});
  await rename(temporary, destination);
  console.log(`Imported reviewed measurements; retained ${updated.queries.deployment_metrics.rows.length} deployment/day rows. Rebuild the dashboard to publish the updated snapshot.`);
}
