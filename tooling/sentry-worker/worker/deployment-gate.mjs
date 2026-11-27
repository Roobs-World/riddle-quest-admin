import {createHash, createHmac, sign, timingSafeEqual} from "node:crypto";

export const REPAIR_BASE_BRANCH = "main";

const PROJECT = "riddle-quest-ec2b2";
const TEAM_ID = "019faa67-d2a6-7169-aa29-a4411a3a3c3d";
const GAME_ID = "019faa68-f3ec-755d-9ab5-c887fb426801";
const MAX_TICKET_AGE_MS = 4 * 60 * 60 * 1000;
const MAX_RECONCILE_AGE_MS = 12 * 60 * 60 * 1000;
const text = (value, limit = 300) => typeof value === "string" ? value.slice(0, limit) : "";

export function sanitizeEvent(event) {
  const tags = Object.fromEntries((event.tags ?? []).map(({key, value}) => [key, value]));
  const exceptions = (event.entries ?? []).filter((entry) => entry.type === "exception").flatMap((entry) => entry.data?.values ?? []);
  const frames = exceptions.flatMap((exception) => exception.stacktrace?.frames ?? []).filter((frame) => frame.inApp || frame.in_app).slice(-20).map((frame) => ({
    filename: text(frame.filename?.split(/[?#]/u)[0]), function: text(frame.function, 160), line: Number.isInteger(frame.lineNo ?? frame.lineno) ? frame.lineNo ?? frame.lineno : undefined,
  }));
  return {
    eventId: text(event.eventID ?? event.id, 64),
    runtime: text(tags.runtime, 64), environment: text(event.environment ?? tags.environment, 100),
    release: text(typeof event.release === "object" ? event.release?.version : event.release ?? tags.release),
    timestamp: text(event.dateCreated ?? event.datetime ?? event.timestamp, 50),
    exceptions: exceptions.slice(0, 3).map((exception) => ({type: text(exception.type, 100), value: text(exception.value, 500)})), frames,
  };
}

async function jsonRequest(url, options = {}, fetcher = fetch) {
  const response = await fetcher(url, {signal: AbortSignal.timeout(12_000), redirect: "error", ...options});
  if (!response.ok) throw new Error(`Authority request to ${new URL(url).hostname}${new URL(url).pathname} failed (${response.status})`);
  return response.json();
}

async function googleToken(env, fetcher) {
  if (!env.SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT) throw new Error("functions_authority_not_configured");
  let account;
  try {account = JSON.parse(env.SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT);} catch {throw new Error("functions_authority_invalid");}
  if (account.type !== "service_account" || !account.client_email || !account.private_key) throw new Error("functions_authority_invalid");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({alg: "RS256", typ: "JWT"})}.${encode({iss: account.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: issuedAt, exp: issuedAt + 3600})}`;
  const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url")}`;
  const result = await jsonRequest("https://oauth2.googleapis.com/token", {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams({grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion})}, fetcher);
  if (typeof result.access_token !== "string") throw new Error("functions_authority_invalid_token");
  return result.access_token;
}

export async function currentFunctions(env = process.env, fetcher = fetch) {
  const token = await googleToken(env, fetcher);
  const found = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({pageSize: "1000", fields: "functions(name,state,serviceConfig(revision,allTrafficOnLatestRevision),buildConfig(sourceProvenance)),nextPageToken"});
    if (pageToken) params.set("pageToken", pageToken);
    const result = await jsonRequest(`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions?${params}`, {headers: {Authorization: `Bearer ${token}`}}, fetcher);
    if (!Array.isArray(result.functions)) throw new Error("functions_authority_invalid_inventory");
    found.push(...result.functions);
    pageToken = result.nextPageToken;
    if (!pageToken) return found;
  }
  throw new Error("functions_authority_incomplete_inventory");
}

async function mcpResponse(response) {
  if (!response.ok) throw new Error(`Jest MCP authority failed (${response.status})`);
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error("jest_authority_response_too_large");
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const messages = body.split(/\r?\n\r?\n/u).flatMap((block) => {
      const data = block.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      return data ? [JSON.parse(data)] : [];
    });
    return messages.findLast((message) => message.result || message.error);
  }
  return body ? JSON.parse(body) : null;
}

async function boundedHtml(url, fetcher) {
  const response = await fetcher(url, {headers: {"Cache-Control": "no-cache", Accept: "text/html"}, cache: "no-store", signal: AbortSignal.timeout(12_000), redirect: "error"});
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("jest_public_authority_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("jest_public_authority_empty");
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 256_000) throw new Error("jest_public_authority_too_large");
      chunks.push(Buffer.from(value));
    }
  } finally {await reader.cancel();}
  return Buffer.concat(chunks).toString("utf8");
}

export async function currentJestProduction(fetcher = fetch) {
  const html = await boundedHtml("https://jest.com/g/riddle-q", fetcher);
  const frames = [...html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/giu)];
  if (frames.length !== 1) throw new Error("jest_public_authority_ambiguous");
  const url = new URL(frames[0][2].replaceAll("&amp;", "&"));
  const match = new RegExp(`^/${GAME_ID}/([A-Za-z0-9][A-Za-z0-9._-]{0,63})/index\\.html$`, "u").exec(url.pathname);
  if (url.protocol !== "https:" || url.hostname !== `${GAME_ID}.builds.jest.com` || url.port || url.username || url.password || url.hash || !match || [...url.searchParams.keys()].some((key) => !["sid", "tce"].includes(key))) throw new Error("jest_public_authority_invalid_frame");
  // The query contains a platform session identifier; neither persist nor log it.
  const resource = `${url.origin}${url.pathname}`;
  const index = await boundedHtml(resource, fetcher);
  if (!/<html\b/iu.test(index)) throw new Error("jest_public_authority_invalid_index");
  return [{id: null, version: match[1], isActive: true, buildStatus: "ready", authority: "public-live-iframe", resource}];
}

export async function currentJestVersions(env = process.env, fetcher = fetch) {
  if (!env.JEST_MCP_ACCESS_TOKEN) throw new Error("jest_authority_not_configured");
  const headers = {Authorization: `Bearer ${env.JEST_MCP_ACCESS_TOKEN}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream"};
  const call = (body) => fetcher("https://jest.com/mcp", {method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000), redirect: "error"});
  const initialized = await call({jsonrpc: "2.0", id: 1, method: "initialize", params: {protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {name: "riddle-quest-sentry-worker", version: "1.0.0"}}});
  const sessionId = initialized.headers.get("mcp-session-id");
  const initialization = await mcpResponse(initialized);
  if (!initialization?.result?.protocolVersion) throw new Error("jest_authority_initialization_failed");
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  headers["MCP-Protocol-Version"] = initialization.result.protocolVersion;
  await mcpResponse(await call({jsonrpc: "2.0", method: "notifications/initialized"}));
  const response = await mcpResponse(await call({jsonrpc: "2.0", id: 2, method: "tools/call", params: {name: "list_game_versions", arguments: {teamId: TEAM_ID, gameId: GAME_ID, limit: 100}}}));
  if (response?.error || response?.result?.isError) throw new Error("jest_authority_tool_failed");
  const content = response?.result?.content?.find((item) => item.type === "text")?.text;
  const versions = content ? JSON.parse(content) : null;
  if (!Array.isArray(versions) || versions.filter((version) => version.isActive).length !== 1) throw new Error("jest_authority_invalid_inventory");
  return versions;
}

export function evaluateDeployment(event, inventory, env = process.env) {
  if (!event.release || !event.environment || !Number.isFinite(Date.parse(event.timestamp))) return {allowed: false, reason: "event_deployment_missing"};
  let deployment;
  if (event.runtime === "jest-html5") {
    if (event.environment !== "production") return {allowed: false, reason: "event_environment_out_of_scope"};
    const matches = inventory.filter((version) => `riddle-quest@${version.version}` === event.release);
    if (matches.length !== 1) return {allowed: false, reason: "jest_release_not_in_inventory"};
    const version = matches[0];
    const previews = new Set((env.SENTRY_WORKER_JEST_PREVIEW_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
    if (version.buildStatus !== "ready" || (!version.isActive && !previews.has(version.id))) return {allowed: false, reason: "jest_release_not_current_or_authorized_preview"};
    const active = inventory.find((candidate) => candidate.isActive);
    deployment = {runtime: event.runtime, environment: event.environment, release: event.release, versionId: version.id, active: version.isActive, activeVersion: active?.version, authority: version.authority ?? "management-mcp", resource: version.resource ?? null};
    if (!active?.version) return {allowed: false, reason: "jest_active_version_missing"};
  } else if (event.runtime === "firebase-functions") {
    if (!["production", PROJECT].includes(event.environment)) return {allowed: false, reason: "event_environment_out_of_scope"};
    // A Git SHA fallback from SENTRY_RELEASE cannot identify a serving revision.
    if (!/^[a-z][a-z0-9-]*-\d{5}-[a-z0-9]+$/u.test(event.release)) return {allowed: false, reason: "functions_runtime_revision_missing"};
    const matches = inventory.filter((candidate) => candidate.serviceConfig?.revision?.split("/").at(-1) === event.release);
    if (matches.length !== 1) return {allowed: false, reason: "functions_revision_not_current"};
    const current = matches[0];
    if (current.state !== "ACTIVE" || current.serviceConfig.allTrafficOnLatestRevision !== true) return {allowed: false, reason: "functions_revision_not_fully_serving"};
    if (!new RegExp(`^projects/${PROJECT}/locations/(us-central1|europe-west1)/functions/[^/]+$`, "u").test(current.name)) return {allowed: false, reason: "functions_resource_out_of_scope"};
    deployment = {runtime: event.runtime, environment: event.environment, release: event.release, resource: current.name, source: current.buildConfig?.sourceProvenance ?? null};
  } else return {allowed: false, reason: "runtime_out_of_scope"};
  return {allowed: true, deployment, fingerprint: createHash("sha256").update(JSON.stringify(deployment)).digest("hex")};
}

export async function verifyDeployment(event, env = process.env, fetcher = fetch, cache = new Map()) {
  try {
    const load = (key, operation) => {
      if (!cache.has(key)) cache.set(key, operation());
      return cache.get(key);
    };
    let inventory;
    if (event.runtime === "jest-html5") {
      inventory = await load("jest-production", () => currentJestProduction(fetcher));
      if (`riddle-quest@${inventory[0].version}` !== event.release) {
        if (!env.JEST_MCP_ACCESS_TOKEN) return {allowed: false, reason: "jest_release_not_current_preview_authority_unavailable"};
        const versions = await load("jest-previews", () => currentJestVersions(env, fetcher));
        if (versions.find((version) => version.isActive)?.version !== inventory[0].version) return {allowed: false, reason: "jest_deployment_authorities_disagree"};
        inventory = versions;
      }
    } else inventory = event.runtime === "firebase-functions" ? await load("functions", () => currentFunctions(env, fetcher)) : [];
    return evaluateDeployment(event, inventory, env);
  } catch (error) {
    return {allowed: false, reason: "deployment_authority_unavailable", detail: /^[a-z][a-z0-9_]+$/u.test(error.message) ? error.message : "authority_request_failed"};
  }
}

export function repairBranch(issueId, fingerprint, timestamp) {
  if (!/^\d+$/u.test(String(issueId)) || !/^[a-f0-9]{64}$/u.test(fingerprint) || !Number.isFinite(Date.parse(timestamp))) throw new Error("Invalid repair identity");
  return `codex/sentry-${issueId}-${fingerprint.slice(0, 12)}-${new Date(timestamp).toISOString().slice(0, 10).replaceAll("-", "")}`;
}

export function signTicket(context, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({...context, issuedAt: now, expiresAt: now + MAX_TICKET_AGE_MS, reconcileExpiresAt: now + MAX_RECONCILE_AGE_MS})).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readTicket(ticket, secret, now = Date.now(), purpose = "repair") {
  if (typeof ticket !== "string" || ticket.length > 20_000 || !secret) return null;
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const context = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isFinite(context.issuedAt) || !Number.isFinite(context.expiresAt) || !Number.isFinite(context.reconcileExpiresAt) || context.issuedAt > now || context.expiresAt - context.issuedAt > MAX_TICKET_AGE_MS || context.reconcileExpiresAt - context.issuedAt > MAX_RECONCILE_AGE_MS || (purpose === "reconcile" ? context.reconcileExpiresAt : context.expiresAt) <= now) return null;
    if (!/^\d+$/u.test(context.issueId) || !/^[a-f0-9]{40}$/u.test(context.baseSha) || !/^[a-f0-9]{40}$/u.test(context.claimSha) || context.base !== REPAIR_BASE_BRANCH || context.branch !== repairBranch(context.issueId, context.fingerprint, context.event.timestamp)) return null;
    return context;
  } catch {return null;}
}
