const CLIENTS = ["web", "ios", "android"];
const ROLES = ["developer", "moderator", "regular", "anonymous"];
const JOURNEYS = ["inline-expanded", "login-reload", "visibility", "payments", "deletion", "recovery"];
const APPROVALS = ["fetch", "payments", "policy", "security"];
const FUNCTIONS = ["exchangeRedditIdentity", "deleteRedditAccount", "redditStorage", "redditGameplay"];
const RULES = ["firestore", "firestore-indexes", "realtime-database", "storage"];
const exact = (actual, expected) => Array.isArray(actual) && actual.length === expected.length &&
  [...actual].sort().join("\0") === [...expected].sort().join("\0");
const iso = (value) => typeof value === "string" && new Date(value).toISOString() === value;
const ref = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 &&
  !value.startsWith("/") && !value.includes("..") && !/[?#]/u.test(value);

export function validateRedditHostedEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1) {
    throw new Error("invalid-reddit-hosted-evidence");
  }
  const {artifact, deployment, clients, approvals} = value;
  if (!artifact || !/^[a-f0-9]{64}$/u.test(artifact.sha256) || !/^[a-f0-9]{40}$/u.test(artifact.sourceCommit) ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(artifact.version) || !ref(artifact.receipt)) {
    throw new Error("invalid-reddit-hosted-artifact");
  }
  if (!deployment || deployment.project !== "riddle-quest-ec2b2" || !ref(deployment.receipt) ||
    !iso(deployment.verifiedAt) || !exact(deployment.functions, FUNCTIONS) || !exact(deployment.rules, RULES)) {
    throw new Error("invalid-reddit-hosted-deployment");
  }
  if (!Array.isArray(clients) || !exact(clients.map(({client}) => client), CLIENTS)) {
    throw new Error("invalid-reddit-hosted-clients");
  }
  for (const client of clients) {
    if (client.status !== "pass" || !iso(client.testedAt) || !exact(client.roles, ROLES) ||
      !exact(client.journeys, JOURNEYS) || !Array.isArray(client.evidence) || client.evidence.length < 1 ||
      !client.evidence.every(ref) || ((client.client === "ios" || client.client === "android") && client.physical !== true)) {
      throw new Error(`invalid-reddit-hosted-client:${client.client}`);
    }
  }
  if (!Array.isArray(approvals) || !exact(approvals.map(({approval}) => approval), APPROVALS)) {
    throw new Error("invalid-reddit-hosted-approvals");
  }
  for (const approval of approvals) {
    if (approval.status !== "approved" || !iso(approval.reviewedAt) || !ref(approval.evidence)) {
      throw new Error(`invalid-reddit-hosted-approval:${approval.approval}`);
    }
  }
  return value;
}

export const REDDIT_HOSTED_EVIDENCE_REQUIREMENTS = {CLIENTS, ROLES, JOURNEYS, APPROVALS, FUNCTIONS, RULES};
