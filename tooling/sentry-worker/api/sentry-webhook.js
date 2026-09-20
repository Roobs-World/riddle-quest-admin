import {createHmac, timingSafeEqual} from "node:crypto";
import {readFile} from "node:fs/promises";
import {Sandbox} from "@vercel/sandbox";

const ORG = "roobs-world-limited";
const PROJECT = "riddle-quest";
const PROJECT_ID = "4511885926006864";
const REPOSITORY = "Grindhead/riddle-quest";

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json");
  response.statusCode = status;
  response.end(body === undefined ? undefined : JSON.stringify(body));
}
function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
export function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = String(signature).replace(/^sha256=/, "");
  const left = Buffer.from(expected); const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function rawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  if (request.body && typeof request.body === "object") return Buffer.from(JSON.stringify(request.body));
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function api(url, token, options = {}) {
  const response = await fetch(url, {...options, headers: {Accept: "application/json", Authorization: `Bearer ${token}`, ...options.headers}});
  if (!response.ok) {
    const endpoint = new URL(url);
    throw new Error(`Upstream request to ${endpoint.hostname}${endpoint.pathname} failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
export function issueIdentity(payload) {
  const issue = payload?.data?.issue ?? payload?.issue ?? payload?.data?.event?.issue;
  const project = payload?.data?.project ?? payload?.project ?? payload?.data?.event?.project;
  if (String(project?.id ?? issue?.project?.id ?? "") !== PROJECT_ID && (project?.slug ?? issue?.project?.slug) !== PROJECT) return null;
  const id = String(issue?.id ?? payload?.data?.event?.groupID ?? "");
  return /^\d+$/.test(id) ? id : null;
}
async function issues(token, query, limit = "100") {
  const params = new URLSearchParams({project: PROJECT_ID, query, sort: "date", limit});
  return api(`https://sentry.io/api/0/organizations/${ORG}/issues/?${params}`, token);
}
async function recentIssues(token) {
  const found = await issues(token, "is:unresolved");
  const cutoff = Date.parse(process.env.WORKER_NOT_BEFORE ?? "2026-09-20T00:00:00Z");
  return found.filter((issue) => Date.parse(issue.lastSeen) >= cutoff);
}
async function issueById(issueId, token) {
  const found = await issues(token, `issue.id:${issueId}`, "5");
  return found.find((issue) => String(issue.id) === String(issueId)) ?? null;
}
async function reserveBranch(issueId, token) {
  const repoUrl = `https://api.github.com/repos/${REPOSITORY}`;
  const base = process.env.TARGET_BRANCH ?? "jest";
  const ref = await api(`${repoUrl}/git/ref/heads/${encodeURIComponent(base)}`, token);
  // Fail before reserving a branch unless this token can enforce the Actions gate.
  await api(`${repoUrl}/actions/workflows/production-readiness.yml/runs?per_page=1`, token, {
    headers: {Accept: "application/vnd.github+json"},
  });
  const branch = `codex/sentry-${issueId}`;
  const response = await fetch(`${repoUrl}/git/refs`, {method: "POST", headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify({ref: `refs/heads/${branch}`, sha: ref.object.sha})});
  if (response.status === 422) return null;
  if (!response.ok) throw new Error(`Unable to reserve repair branch (${response.status})`);
  return {base, branch};
}
function sanitizeIssue(issue) {
  return {id: String(issue.id), shortId: issue.shortId, title: String(issue.title ?? "").slice(0, 300), culprit: String(issue.culprit ?? "").slice(0, 300), level: issue.level, firstSeen: issue.firstSeen, lastSeen: issue.lastSeen, count: issue.count, metadata: {type: issue.metadata?.type, value: String(issue.metadata?.value ?? "").slice(0, 500)}, permalink: issue.permalink};
}
async function launch(issue, credentials) {
  const issueId = String(issue.id);
  const reservation = await reserveBranch(issueId, credentials.github);
  if (!reservation) return {duplicate: true};
  const script = await readFile(new URL("../worker/repair.mjs", import.meta.url));
  const checkPolicy = await readFile(new URL("../worker/check-policy.mjs", import.meta.url));
  const sandbox = await Sandbox.create({
    source: {type: "git", url: `https://github.com/${REPOSITORY}.git`, username: "x-access-token", password: credentials.github, revision: reservation.branch, depth: 20},
    timeout: 3 * 60 * 60 * 1000, resources: {vcpus: 4}, persistent: true,
    tags: {service: "sentry-repair", issue: String(issueId).slice(0, 63)},
  });
  await sandbox.writeFiles([{path: "repair.mjs", content: script}, {path: "check-policy.mjs", content: checkPolicy}, {path: "issue.json", content: Buffer.from(JSON.stringify(sanitizeIssue(issue)))}]);
  await sandbox.runCommand({cmd: "node", args: ["repair.mjs"], detached: true, env: {OPENAI_API_KEY: credentials.openai, GITHUB_TOKEN: credentials.github, REPAIR_BRANCH: reservation.branch, BASE_BRANCH: reservation.base, REPOSITORY, ISSUE_ID: String(issueId), REPO_DIR: "riddle-quest"}});
  return {duplicate: false, sandboxId: sandbox.sandboxId ?? sandbox.id ?? sandbox.name};
}
export async function launchFirstUnclaimed(candidates, launchCandidate) {
  for (const issue of candidates) {
    const result = await launchCandidate(issue);
    if (!result.duplicate) return {issue, result};
  }
  return null;
}
export default async function handler(request, response) {
  if (request.method === "GET" && !header(request, "authorization")) return send(response, 200, {service: "riddle-quest-sentry-worker", status: "active", workerEnabled: true});
  if (request.method === "HEAD") return send(response, 200);
  if (request.method !== "POST" && request.method !== "GET") {
    response.setHeader("Allow", "GET, HEAD, POST");
    return send(response, 405, {error: "method_not_allowed"});
  }
  try {
    if (["SENTRY_AUTH_TOKEN", "SENTRY_WORKER_GITHUB_TOKEN", "OPENAI_API_KEY", "CRON_SECRET"].some((key) => !process.env[key])) return send(response, 503, {error: "worker_not_configured"});
    let issueId; let issue; let result;
    if (request.method === "GET") {
      if (header(request, "authorization") !== `Bearer ${process.env.CRON_SECRET}`) return send(response, 401, {error: "unauthorized"});
      const candidates = await recentIssues(process.env.SENTRY_AUTH_TOKEN);
      const started = await launchFirstUnclaimed(candidates, (candidate) => launch(candidate, {
        sentry: process.env.SENTRY_AUTH_TOKEN,
        github: process.env.SENTRY_WORKER_GITHUB_TOKEN,
        openai: process.env.OPENAI_API_KEY,
      }));
      if (started) {
        ({issue, result} = started);
        issueId = String(issue.id);
      }
      if (!issue) return send(response, 200, {status: candidates.length ? "already_claimed" : "idle"});
    } else {
      const body = await rawBody(request);
      if (!verifySignature(body, header(request, "sentry-hook-signature"), process.env.SENTRY_WEBHOOK_SECRET)) return send(response, 401, {error: "invalid_signature"});
      issueId = issueIdentity(JSON.parse(body.toString("utf8")));
      if (!issueId) return send(response, 202, {status: "ignored"});
    }
    issue ??= await issueById(issueId, process.env.SENTRY_AUTH_TOKEN);
    if (!issue) return send(response, 202, {status: "ignored"});
    result ??= await launch(issue, {sentry: process.env.SENTRY_AUTH_TOKEN, github: process.env.SENTRY_WORKER_GITHUB_TOKEN, openai: process.env.OPENAI_API_KEY});
    return send(response, result.duplicate ? 200 : 202, {status: result.duplicate ? "already_claimed" : "started", issueId, sandboxId: result.sandboxId});
  } catch (error) {
    console.error("Sentry worker launch failed", {name: error?.name, message: error?.message});
    return send(response, 502, {error: "launch_failed"});
  }
}
