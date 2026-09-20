import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {mergeMeasurements} from "./import-deployment-metrics.mjs";
import {googleClient, snapshotStore} from "../../tooling/deployment-monitor/google.mjs";

/** Publish reviewed aggregates without overwriting an intervening collector run. */
export async function publishDeploymentReport(incoming, {store, now = Date.now()}) {
  const current = await store.read("snapshot.json");
  if (!current) throw new Error("Run the cloud collector before publishing measurements");
  const updated = mergeMeasurements(current.data, incoming, now);
  await store.write("snapshot.json", updated, current.generation);
  return updated.queries.deployment_metrics.rows.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, ...extra] = process.argv.slice(2);
  if (!input || extra.length) throw new Error("Usage: node scripts/monitoring/publish-deployment-metrics.mjs <reviewed-report.json>");
  const incoming = JSON.parse(await readFile(input, "utf8"));
  // Capture the existing authorized identity in memory, never in shell arguments.
  const token = execFileSync("gcloud", ["auth", "print-access-token"], {encoding: "utf8"}).trim();
  const store = snapshotStore(googleClient({accessToken: token}), "riddle-quest-monitoring-ec2b2");
  const count = await publishDeploymentReport(incoming, {store});
  console.log(`Published reviewed measurements; retained ${count} deployment/day rows. Open cloud dashboards refresh within one minute.`);
}
