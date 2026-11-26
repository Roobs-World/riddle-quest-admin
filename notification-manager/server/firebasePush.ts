import {createHmac, timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {FirebasePushAudience, FirebasePushDeviceStatus, FirebasePushRegistration} from "../../src/notifications/contracts/firebasePush.js";
import {firebaseBridgeConfiguration, firebaseNotificationTargets, localDevelopmentEnabled} from "./configuration.js";
import {notificationRpc} from "./database.js";
import {deadlineSignal, type Deadline} from "./deadline.js";
import {ApiError, bearer, header, type ApiRequest} from "./http.js";
import {digest} from "./security.js";
import {Hash} from "./model.js";

export async function firebaseAudience(deadline: Deadline) {
  const configuration = firebaseBridgeConfiguration();
  if (!configuration) return {status: "unconfigured"} as const;
  try {
    const response = await fetch(configuration.endpoint, {method: "POST", redirect: "error", signal: deadlineSignal(deadline, 8000),
      headers: {Authorization: `Bearer ${configuration.secret}`, "Content-Type": "application/json"}, body: JSON.stringify({action: "audience"})});
    return {status: "connected", ...FirebasePushAudience.parse(await readFirebaseBridgeResponse(response))} as const;
  } catch {return {status: "unavailable"} as const;}
}

/** No provider message, credential or account identifier crosses this response boundary. */
export async function readFirebaseBridgeResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    const status = [400, 401, 403, 404, 409, 410, 429].includes(response.status) ? response.status : 503;
    throw new ApiError(status, status === 429 ? "notification-rate-limited" : "notification-enrollment-unavailable");
  }
  if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    void response.body?.cancel().catch(() => undefined);
    throw new ApiError(503, "notification-bridge-response-invalid");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(503, "notification-bridge-response-invalid");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) throw new ApiError(503, "notification-bridge-response-invalid");
      text += decoder.decode(part.value, {stream: true});
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    return value;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function requireFirebaseBridge(request: ApiRequest): void {
  if (header(request, "origin")) throw new ApiError(403, "firebase-server-origin-required");
  const configuration = firebaseBridgeConfiguration();
  if (!configuration) throw new ApiError(503, "firebase-bridge-unconfigured");
  const supplied = Buffer.from(bearer(request)), expected = Buffer.from(configuration.secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ApiError(401, "firebase-bridge-authentication-required");
}

export async function registerFirebaseDevice(value: unknown, deadline: Deadline) {
  const parsed = FirebasePushRegistration.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "firebase-registration-invalid");
  const input = parsed.data;
  if (input.enabled) throw new ApiError(410, "browser-push-retired");
  if (!firebaseNotificationTargets().includes(input.target)) throw new ApiError(403, "notification-platform-not-admitted");
  return z.object({installationId: z.string().regex(/^[a-f0-9]{64}$/u), revision: z.number().int().nonnegative().safe()}).strict().parse(
    await notificationRpc(deadline, "notification_register_firebase", {
      p_id: digest(`firebase:${input.deviceHash}`), p_device_hash: input.deviceHash, p_target: input.target,
      p_revision: input.revision, p_enabled: input.enabled, p_locale: input.locale, p_expires_at_ms: input.expiresAtMs,
    }));
}

function enrollmentOrigin(request: ApiRequest): string {
  const origins = new Set<string>();
  const configured = process.env.NOTIFICATION_MANAGER_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" || configured !== url.origin) throw new ApiError(503, "notification-host-unconfigured");
    origins.add(url.origin);
  }
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host && /^[a-z0-9-]+\.vercel\.app$/u.test(host)) origins.add(`https://${host}`);
  }
  const origin = header(request, "origin");
  if (localDevelopmentEnabled() && /^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]+$/u.test(origin)) {
    if (new URL(origin).host === header(request, "host")) return origin;
  }
  if (!origins.has(origin)) throw new ApiError(403, "notification-enrollment-origin-required");
  return origin;
}

async function consumeEnrollmentQuota(request: ApiRequest, origin: string, credential: string, secret: string, deadline: Deadline): Promise<void> {
  const address = process.env.VERCEL === "1"
    ? (header(request, "x-vercel-forwarded-for") || header(request, "x-real-ip")).split(",")[0].trim()
    : localDevelopmentEnabled() ? request.socket.remoteAddress : "";
  if (!address) throw new ApiError(503, "client-address-unavailable");
  const addressHash = createHmac("sha256", secret).update(`firebase-push-rate-v1\0${origin}\0${address}`).digest("hex");
  await notificationRpc(deadline, "notification_consume_quota", {
    p_address_hash: addressHash, p_installation_id: digest(credential),
  });
}

/** Keep the authenticated removal path available to previously enrolled browsers. */
export async function disableBrowserDevice(request: ApiRequest, value: unknown, deadline: Deadline) {
  const origin = enrollmentOrigin(request);
  const input = z.object({deviceToken: Hash}).strict().safeParse(value);
  if (!input.success) throw new ApiError(400, "notification-enrollment-request-invalid");
  const configuration = firebaseBridgeConfiguration();
  if (!configuration) throw new ApiError(503, "firebase-bridge-unconfigured");
  await consumeEnrollmentQuota(request, origin, input.data.deviceToken, configuration.secret, deadline);
  const response = await fetch(configuration.endpoint, {method: "POST", headers: {
    Authorization: `Bearer ${configuration.secret}`, Accept: "application/json", "Content-Type": "application/json"},
    body: JSON.stringify({action: "disable", deviceToken: input.data.deviceToken}),
    redirect: "error", signal: deadlineSignal(deadline, 15_000)});
  return FirebasePushDeviceStatus.parse(await readFirebaseBridgeResponse(response));
}
