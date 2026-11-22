import {createHmac, timingSafeEqual} from "node:crypto";
import {readFile} from "node:fs/promises";
import {Sandbox} from "@vercel/sandbox";
import {evaluateWorkflowRuns} from "../worker/check-policy.mjs";
import {readTicket, repairBranch, sanitizeEvent, signTicket, verifyDeployment} from "../worker/deployment-gate.mjs";
import {completeRepair} from "../worker/github-repair.mjs";

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
  if (!request[Symbol.asyncIterator]) {
    if (Buffer.isBuffer(request.body)) return request.body;
    if (typeof request.body === "string") return Buffer.from(request.body);
    throw new Error("raw_request_bytes_required");
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += Buffer.byteLength(chunk);
    if (length > 400_000) throw new Error("request_body_too_large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function api(url, token, options = {}) {
  const response = await fetch(url, {signal: AbortSignal.timeout(12_000), redirect: "error", ...options, headers: {Accept: "application/json", Authorization: `Bearer ${token}`, ...options.headers}});
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
async function eventForIssue(issueId, token) {
  return sanitizeEvent(await api(`https://sentry.io/api/0/organizations/${ORG}/issues/${issueId}/events/latest/`, token));
}
const CLAIM_TIMEOUT_MS = 4 * 60 * 60 * 1000;

async function createClaim(repoUrl, baseRef, branch, issueId, token) {
  const commit = await api(`${repoUrl}/git/commits/${baseRef.object.sha}`, token);
  const claim = await api(`${repoUrl}/git/commits`, token, {
    method: "POST",
    headers: {Accept: "application/vnd.github+json", "Content-Type": "application/json"},
    body: JSON.stringify({
      message: `[sentry-worker] Claim issue ${issueId}`,
      tree: commit.tree.sha,
      parents: [baseRef.object.sha],
    }),
  });
  await api(`${repoUrl}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
    method: "PATCH",
    headers: {Accept: "application/vnd.github+json", "Content-Type": "application/json"},
    body: JSON.stringify({sha: claim.sha}),
  });
  return claim.sha;
}

export async function reserveBranch(issueId, token, identity, now = Date.now()) {
  const repoUrl = `https://api.github.com/repos/${REPOSITORY}`;
  const base = process.env.TARGET_BRANCH ?? "jest";
  if (base !== "jest") throw new Error("unsupported_base_branch");
  const ref = await api(`${repoUrl}/git/ref/heads/${encodeURIComponent(base)}`, token);
  // Fail before reserving a branch unless this token can enforce the Actions gate.
  await api(`${repoUrl}/actions/workflows/production-readiness.yml/runs?per_page=1`, token, {
    headers: {Accept: "application/vnd.github+json"},
  });
  const branch = repairBranch(issueId, identity.fingerprint, identity.event.timestamp);
  let response = await fetch(`${repoUrl}/git/refs`, {method: "POST", headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify({ref: `refs/heads/${branch}`, sha: ref.object.sha})});
  if (response.status === 422) {
    const pulls = await api(`${repoUrl}/pulls?state=all&head=${encodeURIComponent(`Grindhead:${branch}`)}&per_page=1`, token, {
      headers: {Accept: "application/vnd.github+json"},
    });
    if (pulls.length) return null;
    const existing = await api(`${repoUrl}/branches/${encodeURIComponent(branch)}`, token);
    const updatedAt = Date.parse(existing.commit?.commit?.committer?.date ?? "");
    if (!Number.isFinite(updatedAt) || now - updatedAt < CLAIM_TIMEOUT_MS) return null;
    await api(`${repoUrl}/git/refs/heads/${encodeURIComponent(branch)}`, token, {method: "DELETE"});
    response = await fetch(`${repoUrl}/git/refs`, {method: "POST", headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify({ref: `refs/heads/${branch}`, sha: ref.object.sha})});
  }
  if (!response.ok) throw new Error(`Unable to reserve repair branch (${response.status})`);
  const claimSha = await createClaim(repoUrl, ref, branch, issueId, token);
  return {base, branch, baseSha: ref.object.sha, claimSha};
}
function hourlyBudgetBranch(now = new Date()) {
  const hour = now.toISOString().slice(0, 13).replaceAll("-", "").replace("T", "-");
  return `codex/sentry-budget-${hour}`;
}
async function hourlyBudgetAvailable(token) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(hourlyBudgetBranch())}`, {headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(12_000), redirect: "error"});
  if (response.status === 404) return true;
  if (!response.ok) throw new Error("Unable to read hourly repair budget");
  return false;
}
export async function reserveHourlyBudget(token, sha, now = new Date()) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/refs`, {method: "POST", signal: AbortSignal.timeout(12_000), redirect: "error", headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify({ref: `refs/heads/${hourlyBudgetBranch(now)}`, sha})});
  if (response.status === 422) return false;
  if (!response.ok) throw new Error(`Unable to reserve hourly repair budget (${response.status})`);
  return true;
}
async function sourceArchive(sha, token) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/tarball/${sha}`, {headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"}, signal: AbortSignal.timeout(12_000), redirect: "manual"});
  const location = response.headers.get("location");
  if (response.status !== 302 || !location || new URL(location).hostname !== "codeload.github.com" || new URL(location).protocol !== "https:") throw new Error("source_archive_unavailable");
  const archive = await fetch(location, {signal: AbortSignal.timeout(90_000), redirect: "error"});
  if (!archive.ok || !archive.body) throw new Error("source_archive_unavailable");
  const reader = archive.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 128 * 1024 * 1024) throw new Error("source_archive_too_large");
      chunks.push(Buffer.from(value));
    }
  } finally {await reader.cancel();}
  return Buffer.concat(chunks);
}
export async function checkRepairContext(context, token, verify = verifyDeployment) {
  const deployment = await verify(context.event);
  if (!deployment.allowed) return {allowed: false, reason: deployment.reason};
  if (deployment.fingerprint !== context.fingerprint) return {allowed: false, reason: "deployment_changed"};
  const ref = await api(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(context.base)}`, token);
  return ref.object.sha === context.baseSha ? {allowed: true} : {allowed: false, reason: "base_branch_changed"};
}
export async function reconcileRepair(issueId, token, branch, verify = verifyDeployment) {
  const repoUrl = `https://api.github.com/repos/${REPOSITORY}`;
  const pulls = await api(`${repoUrl}/pulls?state=open&head=${encodeURIComponent(`Grindhead:${branch}`)}&per_page=1`, token, {
    headers: {Accept: "application/vnd.github+json"},
  });
  const pull = pulls[0];
  if (!pull) return null;
  const ticket = /<!-- sentry-worker-ticket:([A-Za-z0-9_.-]+) -->/u.exec(pull.body ?? "")?.[1];
  const context = readTicket(ticket, process.env.CRON_SECRET, Date.now(), "reconcile");
  if (!context || context.issueId !== String(issueId) || context.branch !== branch || pull.base?.ref !== context.base) return {status: "blocked", reason: "repair_ticket_invalid_or_expired", pullRequest: pull.number};
  const workflowRuns = await api(
    `${repoUrl}/actions/workflows/production-readiness.yml/runs?branch=${encodeURIComponent(branch)}&event=pull_request&per_page=20`,
    token,
    {headers: {Accept: "application/vnd.github+json"}},
  );
  const checks = evaluateWorkflowRuns(workflowRuns.workflow_runs, pull.head.sha);
  if (checks.state !== "passed") return {status: checks.state === "failed" ? "checks_failed" : "checks_pending", pullRequest: pull.number};
  const gate = await checkRepairContext(context, token, verify);
  if (!gate.allowed) return {status: "blocked", reason: gate.reason, pullRequest: pull.number};
  if (process.env.SENTRY_WORKER_AUTO_MERGE !== "1") return {status: "ready_for_review", pullRequest: pull.number, releaseWorkPending: true};
  const merged = await api(`${repoUrl}/pulls/${pull.number}/merge`, token, {
    method: "PUT",
    headers: {Accept: "application/vnd.github+json", "Content-Type": "application/json"},
    body: JSON.stringify({sha: pull.head.sha, merge_method: "squash", commit_title: pull.title}),
  });
  if (!merged.merged) throw new Error(`Pull request was not merged: ${merged.message ?? "unknown reason"}`);
  return {status: "merged", pullRequest: pull.number};
}
function sanitizeIssue(issue) {
  return {id: String(issue.id), shortId: issue.shortId, title: String(issue.title ?? "").slice(0, 300), culprit: String(issue.culprit ?? "").slice(0, 300), level: issue.level, firstSeen: issue.firstSeen, lastSeen: issue.lastSeen, count: issue.count, metadata: {type: issue.metadata?.type, value: String(issue.metadata?.value ?? "").slice(0, 500)}, permalink: issue.permalink};
}
async function launch(issue, credentials, start = true, screen = verifyDeployment, deadline = Infinity) {
  const issueId = String(issue.id);
  const event = await eventForIssue(issueId, credentials.sentry);
  const deployment = await screen(event);
  if (!deployment.allowed) return {blocked: true, reason: deployment.reason, detail: deployment.detail};
  if (!start) return {queued: true};
  const branch = repairBranch(issueId, deployment.fingerprint, event.timestamp);
  const reconciliation = await reconcileRepair(issueId, credentials.github, branch);
  if (reconciliation) return {duplicate: true, reconciliation};
  const gateUrl = process.env.SENTRY_WORKER_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/sentry-webhook` : null);
  if (!gateUrl || new URL(gateUrl).protocol !== "https:") return {blocked: true, reason: "repair_check_url_not_configured"};
  if (Date.now() >= deadline) return {blocked: true, stop: true, reason: "selection_budget_exhausted"};
  if (!await hourlyBudgetAvailable(credentials.github)) return {blocked: true, stop: true, reason: "hourly_repair_budget_consumed"};
  const fresh = await verifyDeployment(event);
  if (!fresh.allowed || fresh.fingerprint !== deployment.fingerprint) return {blocked: true, reason: fresh.reason ?? "deployment_changed"};
  const reservation = await reserveBranch(issueId, credentials.github, {fingerprint: deployment.fingerprint, event});
  if (!reservation) return {duplicate: true};
  if (!await reserveHourlyBudget(credentials.github, reservation.baseSha)) {
    const refUrl = `https://api.github.com/repos/${REPOSITORY}/git/refs/heads/${encodeURIComponent(reservation.branch)}`;
    const current = await api(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(reservation.branch)}`, credentials.github);
    if (current.object.sha === reservation.claimSha) await api(refUrl, credentials.github, {method: "DELETE"});
    return {blocked: true, stop: true, reason: "hourly_repair_budget_consumed"};
  }
  const context = {issueId, event: {...event, frames: [], exceptions: []}, fingerprint: deployment.fingerprint, ...reservation};
  const ticket = signTicket(context, process.env.CRON_SECRET);
  const script = await readFile(new URL("../worker/repair.mjs", import.meta.url));
  const payloadPolicy = await readFile(new URL("../worker/repair-payload.mjs", import.meta.url));
  const archive = await sourceArchive(reservation.baseSha, credentials.github);
  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: 3 * 60 * 60 * 1000, resources: {vcpus: 4}, persistent: true,
    tags: {service: "sentry-repair", issue: String(issueId).slice(0, 63)},
  });
  await sandbox.writeFiles([{path: "repair.mjs", content: script}, {path: "repair-payload.mjs", content: payloadPolicy}, {path: "source.tar.gz", content: archive}, {path: "issue.json", content: Buffer.from(JSON.stringify({...sanitizeIssue(issue), event, deployment: deployment.deployment}))}]);
  await sandbox.runCommand({cmd: "node", args: ["repair.mjs"], detached: true, env: {OPENAI_API_KEY: credentials.openai, REPO_DIR: "riddle-quest", REPAIR_CHECK_URL: gateUrl, REPAIR_TICKET: ticket}});
  return {duplicate: false, sandboxId: sandbox.sandboxId ?? sandbox.id ?? sandbox.name};
}
export async function launchFirstUnclaimed(candidates, launchCandidate) {
  const deadline = Date.now() + 40_000;
  for (const issue of candidates) {
    if (Date.now() >= deadline) break;
    const result = await launchCandidate(issue, deadline);
    if (result.stop) break;
    if (!result.duplicate && !result.blocked) return {issue, result};
  }
  return null;
}
export default async function handler(request, response) {
  const required = ["SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_SECRET", "SENTRY_WORKER_GITHUB_TOKEN", "OPENAI_API_KEY", "CRON_SECRET"];
  const configured = required.every((key) => Boolean(process.env[key]));
  if (request.method === "GET" && !header(request, "authorization")) return send(response, 200, {service: "riddle-quest-sentry-worker", status: configured ? "configured" : "not_configured", workerEnabled: configured, autoMergeEnabled: process.env.SENTRY_WORKER_AUTO_MERGE === "1", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SENTRY_WORKER_SOURCE_SHA ?? null, authorityConfigured: {jestProduction: "public-live-iframe", jestPreviews: Boolean(process.env.JEST_MCP_ACCESS_TOKEN), functions: Boolean(process.env.SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT)}});
  if (request.method === "HEAD") return send(response, 200);
  if (request.method !== "POST" && request.method !== "GET") {
    response.setHeader("Allow", "GET, HEAD, POST");
    return send(response, 405, {error: "method_not_allowed"});
  }
  try {
    if (!configured) return send(response, 503, {error: "worker_not_configured"});
    if (request.method === "POST" && (header(request, "x-sentry-repair-check") === "1" || header(request, "x-sentry-repair-complete") === "1")) {
      const payload = JSON.parse((await rawBody(request)).toString("utf8"));
      const context = readTicket(payload.ticket, process.env.CRON_SECRET);
      if (!context) return send(response, 401, {status: "blocked", reason: "repair_ticket_invalid_or_expired"});
      if (header(request, "x-sentry-repair-complete") === "1") {
        const completed = await completeRepair(context, payload, process.env.SENTRY_WORKER_GITHUB_TOKEN, (current) => checkRepairContext(current, process.env.SENTRY_WORKER_GITHUB_TOKEN));
        return send(response, completed.status === "blocked" ? 409 : 200, completed);
      }
      const gate = await checkRepairContext(context, process.env.SENTRY_WORKER_GITHUB_TOKEN);
      return send(response, gate.allowed ? 200 : 409, {status: gate.allowed ? "verified" : "blocked", reason: gate.reason});
    }
    let issueId; let issue; let result;
    if (request.method === "GET") {
      if (header(request, "authorization") !== `Bearer ${process.env.CRON_SECRET}`) return send(response, 401, {error: "unauthorized"});
      const candidates = await recentIssues(process.env.SENTRY_AUTH_TOKEN);
      const outcomes = [];
      const authorityCache = new Map();
      const screen = (event) => verifyDeployment(event, process.env, fetch, authorityCache);
      const started = await launchFirstUnclaimed(candidates, (candidate, deadline) => launch(candidate, {
        sentry: process.env.SENTRY_AUTH_TOKEN,
        github: process.env.SENTRY_WORKER_GITHUB_TOKEN,
        openai: process.env.OPENAI_API_KEY,
      }, true, screen, deadline).then((outcome) => {outcomes.push({issueId: String(candidate.id), status: outcome.blocked ? "blocked" : outcome.reconciliation?.status ?? (outcome.duplicate ? "already_claimed" : "started"), reason: outcome.reason ?? outcome.reconciliation?.reason, detail: outcome.detail}); return outcome;}));
      if (started) {
        ({issue, result} = started);
        issueId = String(issue.id);
      }
      if (!issue) return send(response, 200, {status: candidates.length ? "checked" : "idle", outcomes});
    } else {
      const body = await rawBody(request);
      if (!verifySignature(body, header(request, "sentry-hook-signature"), process.env.SENTRY_WEBHOOK_SECRET)) return send(response, 401, {error: "invalid_signature"});
      issueId = issueIdentity(JSON.parse(body.toString("utf8")));
      if (!issueId) return send(response, 202, {status: "ignored"});
    }
    issue ??= await issueById(issueId, process.env.SENTRY_AUTH_TOKEN);
    if (!issue) return send(response, 202, {status: "ignored"});
    result ??= await launch(issue, {sentry: process.env.SENTRY_AUTH_TOKEN, github: process.env.SENTRY_WORKER_GITHUB_TOKEN, openai: process.env.OPENAI_API_KEY}, false);
    if (result.blocked) return send(response, 202, {status: "blocked", issueId, reason: result.reason, detail: result.detail});
    if (result.queued) return send(response, 202, {status: "queued", issueId});
    if (result.reconciliation) return send(response, 200, {...result.reconciliation, issueId});
    return send(response, result.duplicate ? 200 : 202, {status: result.duplicate ? "already_claimed" : "started", issueId, sandboxId: result.sandboxId});
  } catch (error) {
    console.error("Sentry worker launch failed", {name: error?.name, message: error?.message});
    return send(response, 502, {error: "launch_failed"});
  }
}
