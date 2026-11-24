import type {IncomingMessage, ServerResponse} from "node:http";
import {timingSafeEqual} from "node:crypto";
import {notificationDatabase} from "./database.js";
import {ApiError} from "./errors.js";
import {remainingMs, type Deadline} from "./deadline.js";
export {ApiError} from "./errors.js";

export interface ApiRequest extends IncomingMessage {body?: unknown; query?: Record<string, string | string[] | undefined>}
export type ApiResponse = ServerResponse;

export function header(request: ApiRequest, name: string): string {
  const value = request.headers[name.toLowerCase()];
  return typeof value === "string" ? value : "";
}

export function bearer(request: ApiRequest): string {
  const match = /^Bearer ([^\s]{1,4096})$/u.exec(header(request, "authorization"));
  return match?.[1] ?? "";
}

export function json(response: ApiResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(value));
}

export function fail(response: ApiResponse, error: unknown): void {
  if (response.writableEnded) return;
  if (error instanceof ApiError) {json(response, error.status, {error: error.code}); return;}
  // Never send or log provider errors, whose messages can contain subscription credentials.
  json(response, 503, {error: "notification-service-unavailable"});
}

export async function body(request: ApiRequest, deadline: Deadline, maximum = 8192): Promise<unknown> {
  if (!header(request, "content-type").toLowerCase().startsWith("application/json")) throw new ApiError(415, "json-required");
  const length = Number(header(request, "content-length"));
  if (Number.isFinite(length) && length > maximum) throw new ApiError(413, "request-too-large");
  let value: unknown = request.body;
  if (value !== undefined) {
    if (typeof value === "string" || Buffer.isBuffer(value)) {
      const text = value.toString();
      if (Buffer.byteLength(text) > maximum) throw new ApiError(413, "request-too-large");
      try {return JSON.parse(text);} catch {throw new ApiError(400, "invalid-json");}
    }
    if (Buffer.byteLength(JSON.stringify(value)) > maximum) throw new ApiError(413, "request-too-large");
    return value;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  const timeoutMs = Math.min(12_000, remainingMs(deadline));
  if (timeoutMs < 1) throw new ApiError(503, "notification-request-deadline");
  const timeout = setTimeout(() => request.destroy(new ApiError(408, "request-body-timeout")), timeoutMs);
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > maximum) throw new ApiError(413, "request-too-large");
      chunks.push(buffer);
    }
  } finally {clearTimeout(timeout);}
  try {value = JSON.parse(Buffer.concat(chunks).toString("utf8"));} catch {throw new ApiError(400, "invalid-json");}
  return value;
}

/** Fresh Supabase identity and database membership authorize management actions. */
export async function requireOperator(request: ApiRequest, deadline: Deadline): Promise<string> {
  const token = bearer(request);
  if (!token) throw new ApiError(401, "operator-authentication-required");
  try {
    const database = notificationDatabase(deadline);
    const {data, error} = await database.auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, "operator-authentication-invalid");
    const operator = await database.from("notification_operators").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (operator.error) throw new ApiError(503, "operator-membership-unavailable");
    if (!operator.data) throw new ApiError(403, "operator-access-denied");
    return data.user.id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "operator-authentication-unavailable");
  }
}

export function requireCron(request: ApiRequest): void {
  const expected = process.env.CRON_SECRET ?? "";
  const actual = bearer(request);
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (expected.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, "cron-authentication-required");
}
