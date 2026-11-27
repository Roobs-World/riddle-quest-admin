import {currentFunctions, REPAIR_BASE_BRANCH} from "./deployment-gate.mjs";

const env = process.env;
const names = ["SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_SECRET", "SENTRY_WORKER_GITHUB_TOKEN", "OPENAI_API_KEY", "CRON_SECRET"];
const secretPresence = Object.fromEntries(names.map((name) => [name, Boolean(env[name])]));
async function probe(operation) {
  try {return {available: true, ...await operation()};}
  catch {return {available: false};}
}
async function read(url, token) {
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`, Accept: "application/json"}, signal: AbortSignal.timeout(12_000), redirect: "error"});
  if (!response.ok) throw new Error("Read unavailable");
  return response.json();
}
const sentry = await probe(async () => {
  if (!env.SENTRY_AUTH_TOKEN) throw new Error("Not configured");
  const issues = await read("https://sentry.io/api/0/organizations/roobs-world-limited/issues/?project=4511885926006864&query=is%3Aunresolved&limit=1", env.SENTRY_AUTH_TOKEN);
  if (!Array.isArray(issues)) throw new Error("Invalid inventory");
  if (issues[0]) await read(`https://sentry.io/api/0/organizations/roobs-world-limited/issues/${issues[0].id}/events/latest/`, env.SENTRY_AUTH_TOKEN);
  return {issueAndEventRead: Boolean(issues[0]), emptyInventory: issues.length === 0};
});
const github = await probe(async () => {
  if (!env.SENTRY_WORKER_GITHUB_TOKEN) throw new Error("Not configured");
  await read("https://api.github.com/repos/Grindhead/riddle-quest/actions/workflows/production-readiness.yml/runs?per_page=1", env.SENTRY_WORKER_GITHUB_TOKEN);
  return {workflowRead: true};
});
const functions = await probe(async () => {
  const inventory = await currentFunctions();
  return {functionCount: inventory.length, activeCount: inventory.filter((item) => item.state === "ACTIVE").length};
});
const targetBranch = env.TARGET_BRANCH ?? REPAIR_BASE_BRANCH;
const ready = targetBranch === REPAIR_BASE_BRANCH && Object.values(secretPresence).every(Boolean) && sentry.available && github.available && functions.available;
console.log(JSON.stringify({status: ready ? "ready_for_deployment_verification" : "partial_or_blocked", targetBranch, autoMergeEnabled: env.SENTRY_WORKER_AUTO_MERGE === "1", secretPresence, sentry, github, authorities: {functions}}, null, 2));
process.exitCode = ready ? 0 : 1;
