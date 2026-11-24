import {createHash, createHmac} from "node:crypto";
import {admittedOrigins, localDevelopmentEnabled, vapidConfiguration} from "./configuration.js";
import {notificationRpc} from "./database.js";
import {ApiError, bearer, header, type ApiRequest, type ApiResponse} from "./http.js";
import type {Deadline} from "./deadline.js";

export const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export function installationCredential(request: ApiRequest): string {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/u.test(token)) throw new ApiError(401, "installation-credential-required");
  return token;
}

export function browserOrigin(request: ApiRequest, target: string, allowAbsent = false): string {
  const expected = admittedOrigins()[target];
  if (!expected) throw new ApiError(403, "notification-platform-not-admitted");
  const origin = header(request, "origin");
  if (!(origin === expected || allowAbsent && !origin)) throw new ApiError(403, "notification-origin-not-admitted");
  return expected;
}

/** CORS is narrowly scoped; the installation credential independently authorizes mutations. */
export function browserCors(request: ApiRequest, response: ApiResponse): boolean {
  const origin = header(request, "origin");
  if (origin) {
    if (!Object.values(admittedOrigins()).includes(origin)) throw new ApiError(403, "notification-origin-not-admitted");
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  if (request.method !== "OPTIONS") return false;
  if (!origin) throw new ApiError(403, "notification-origin-required");
  const method = header(request, "access-control-request-method");
  if (!["GET", "POST"].includes(method)) throw new ApiError(405, "method-not-allowed");
  const headers = header(request, "access-control-request-headers").toLowerCase().split(",").map(value => value.trim()).filter(Boolean);
  if (headers.some(value => !["authorization", "content-type"].includes(value))) throw new ApiError(400, "request-headers-not-admitted");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
  response.statusCode = 204;
  response.end();
  return true;
}

const localLimits = new Map<string, {resetAtMs: number; count: number}>();

/** Uses Vercel's overwritten client-address metadata, never a request-body address. */
function clientAddress(request: ApiRequest): string {
  if (process.env.VERCEL === "1") {
    const value = header(request, "x-vercel-forwarded-for") || header(request, "x-real-ip");
    if (value) return value.split(",")[0].trim();
    throw new ApiError(503, "client-address-unavailable");
  }
  if (!localDevelopmentEnabled()) throw new ApiError(503, "notification-host-unavailable");
  return request.socket.remoteAddress || "loopback";
}

/** Per-address and per-installation limits bound both anonymous registration and renewal. */
export async function consumeBrowserQuota(request: ApiRequest, origin: string, installationId: string, deadline: Deadline, nowMs = Date.now()): Promise<void> {
  const secret = vapidConfiguration().privateKey;
  const address = createHmac("sha256", secret).update(`notification-rate-v1\0${origin}\0${clientAddress(request)}`).digest("hex");
  const minute = Math.floor(nowMs / 60_000);
  const memoryKey = `${address}:${minute}`;
  for (const [key, value] of localLimits) if (value.resetAtMs <= nowMs) localLimits.delete(key);
  const cached = localLimits.get(memoryKey);
  if (cached && cached.count >= 30 || !cached && localLimits.size >= 5000) throw new ApiError(429, "notification-rate-limited");
  localLimits.set(memoryKey, {resetAtMs: (minute + 1) * 60_000, count: (cached?.count ?? 0) + 1});
  await notificationRpc(deadline, "notification_consume_quota", {p_address_hash: address, p_installation_id: installationId});
}
