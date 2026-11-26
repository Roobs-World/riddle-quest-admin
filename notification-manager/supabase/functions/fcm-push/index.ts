import {timingSafeEqual} from "node:crypto";
import {FcmDeliveryRequest, FcmDeliveryResult} from "../../../../src/notifications/contracts/fcmDelivery.ts";
import {FCM_ENDPOINT, googleAccessToken} from "./google.ts";

const MAX_BODY_BYTES = 16_384;
const encoder = new TextEncoder();

function json(value: unknown, status = 200): Response {
  return Response.json(value, {status, headers: {"Cache-Control": "no-store"}});
}

function authorized(request: Request): boolean {
  const secret = Deno.env.get("NOTIFICATION_FCM_EDGE_SECRET") ?? "";
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(secret) || request.headers.has("Origin")) return false;
  const supplied = encoder.encode(request.headers.get("Authorization") ?? "");
  const expected = encoder.encode(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJson(response: Request | Response, maximum: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("body-required");
  const decoder = new TextDecoder();
  let bytes = 0, value = "";
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximum) throw new Error("body-too-large");
      value += decoder.decode(part.value, {stream: true});
    }
    return JSON.parse(value + decoder.decode());
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function providerRejected(value: unknown): "unregistered" | "rejected" {
  if (value && typeof value === "object" && "error" in value && value.error && typeof value.error === "object" &&
      "details" in value.error && Array.isArray(value.error.details) && value.error.details.some(detail =>
        detail && typeof detail === "object" && "@type" in detail &&
        detail["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError" &&
        "errorCode" in detail && detail.errorCode === "UNREGISTERED")) return "unregistered";
  return "rejected";
}

export async function handleFcmPush(request: Request): Promise<Response> {
  const deadlineAtMs = Date.now() + 6500;
  if (!authorized(request)) return json({error: "server-authorization-required"}, 401);
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path.endsWith("/fcm-push/health")) {
    try {
      await googleAccessToken();
      return json({status: "ready", projectId: "riddle-quest-ec2b2"});
    } catch {return json({error: "fcm-credentials-unavailable"}, 503);}
  }
  if (request.method !== "POST") return json({error: "method-not-allowed"}, 405);
  if (!path.endsWith("/fcm-push")) return json({error: "not-found"}, 404);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    return json({error: "json-required"}, 415);
  let value: unknown;
  try {value = await readJson(request, MAX_BODY_BYTES);} catch {return json({error: "invalid-request"}, 400);}
  const parsed = FcmDeliveryRequest.safeParse(value);
  const now = Date.now();
  if (!parsed.success || parsed.data.expiresAtMs > now + 6 * 3_600_000 + 60_000)
    return json({error: "invalid-request"}, 400);
  const input = parsed.data;
  if (input.expiresAtMs <= now) return json(FcmDeliveryResult.parse({outcome: "skipped", reason: "expired"}));
  if (encoder.encode(JSON.stringify(input.data)).length > 3800)
    return json(FcmDeliveryResult.parse({outcome: "failed", reason: "rejected"}));
  try {
    const accessToken = await googleAccessToken();
    const remainingMs = input.expiresAtMs - Date.now();
    if (remainingMs <= 0) return json(FcmDeliveryResult.parse({outcome: "skipped", reason: "expired"}));
    const requestTimeoutMs = deadlineAtMs - Date.now();
    if (requestTimeoutMs <= 0) return json(FcmDeliveryResult.parse({outcome: "uncertain"}));
    const message = {token: input.token, android: {priority: "HIGH", restricted_package_name: "com.roobsworld.riddlequest",
      ttl: `${Math.floor(remainingMs / 1000)}s`, data: input.data}};
    const response = await fetch(FCM_ENDPOINT, {method: "POST", redirect: "error", signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json"}, body: JSON.stringify({message})});
    let result: unknown;
    try {result = await readJson(response, 8192);} catch {return json(FcmDeliveryResult.parse({outcome: "uncertain"}));}
    if (response.ok && result && typeof result === "object" && "name" in result &&
        typeof result.name === "string" && result.name.startsWith("projects/riddle-quest-ec2b2/messages/"))
      return json(FcmDeliveryResult.parse({outcome: "accepted"}));
    if (response.status === 408 || response.status === 429 || response.status >= 500 || response.ok)
      return json(FcmDeliveryResult.parse({outcome: "uncertain"}));
    return json(FcmDeliveryResult.parse({outcome: "failed", reason: providerRejected(result)}));
  } catch {return json(FcmDeliveryResult.parse({outcome: "uncertain"}));}
}

Deno.serve(handleFcmPush);
